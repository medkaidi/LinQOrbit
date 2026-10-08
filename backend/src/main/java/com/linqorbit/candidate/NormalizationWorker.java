package com.linqorbit.candidate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.NormalizeRequest;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.common.logging.RequestLoggingFilter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Exécution asynchrone des jobs de normalisation : polling périodique, claim
 * atomique (CAS PENDING→RUNNING, sûr multi-instances), appels IA en dehors de
 * toute tx, transitions de fin en txs courtes ({@link TransactionTemplate} —
 * les appels internes passent par le proxy, jamais d'auto-invoque @Transactional).
 *
 * <p>Robustesse : backoff fixe entre tentatives (3 essais max puis FAILED),
 * récupération des jobs RUNNING périmés (worker mort en plein appel IA),
 * MDC {@code correlationId} = id du job pendant l'exécution.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NormalizationWorker {

    /** Nombre maximal d'exécutions d'un même job avant abandonment définitif. */
    static final int MAX_ATTEMPTS = 3;
    /** Backoff fixe entre deux tentatives. */
    static final int RETRY_DELAY_SECONDS = 60;
    /** Un RUNNING plus vieux que ce seuil est considéré orphelin (worker mort). */
    static final int STALE_RUNNING_MINUTES = 10;
    /** Taille max de la colonne normalization_job.error. */
    private static final int ERROR_MAX_LENGTH = 500;

    private final TransactionTemplate transactionTemplate;
    private final NormalizationJobRepository normalizationJobRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private final CandidateService candidateService;
    private final ReferenceContextBuilder referenceContextBuilder;
    private final ProfileNormalizeClient profileNormalizeClient;

    @Scheduled(fixedDelayString = "${app.normalization.poll-interval-ms:5000}",
            initialDelayString = "${app.normalization.initial-delay-ms:5000}")
    public void poll() {
        try {
            recoverStaleRunningJobs();
            processReadyJobs();
        } catch (Exception ex) {
            log.error("Normalization poll failed", ex);
        }
    }

    /** Re-bascule en PENDING (ou FAILED) les jobs RUNNING dont le worker est mort. */
    private void recoverStaleRunningJobs() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(STALE_RUNNING_MINUTES);
        List<NormalizationJob> stale = normalizationJobRepository
                .findByStatusAndStartedAtLessThanEqual(NormalizationJobStatus.RUNNING, threshold);
        for (NormalizationJob job : stale) {
            log.warn("Recovering stale RUNNING normalization job : jobId={}, startedAt={}",
                    job.getId(), job.getStartedAt());
            retryOrFail(job, "Worker presumed dead before completion");
        }
    }

    /** Réclame et exécute les jobs prêts, jusqu'à épuisement. */
    private void processReadyJobs() {
        while (true) {
            NormalizationJob job = claimNext();
            if (job == null) {
                return;
            }
            execute(job);
        }
    }

    /** Tx courte : liste des prêts + CAS PENDING→RUNNING, un seul vainqueur. */
    private NormalizationJob claimNext() {
        return transactionTemplate.execute(status -> {
            LocalDateTime now = LocalDateTime.now();
            List<NormalizationJob> ready = normalizationJobRepository
                    .findByStatusAndNextAttemptAtLessThanEqual(
                            NormalizationJobStatus.PENDING, now, PageRequest.of(0, 5));
            for (NormalizationJob candidate : ready) {
                int claimed = normalizationJobRepository.casStatus(candidate.getId(),
                        NormalizationJobStatus.PENDING, NormalizationJobStatus.RUNNING, now);
                if (claimed == 1) {
                    return normalizationJobRepository.findById(candidate.getId()).orElse(null);
                }
            }
            return null;
        });
    }

    /** Appel IA hors tx ; écriture du contenu + DONE en une tx courte. */
    private void execute(NormalizationJob job) {
        MDC.put(RequestLoggingFilter.CORRELATION_ID, job.getId().toString());
        try {
            UUID candidateId = normalizedProfileCandidateRepository
                    .findCandidateIdByNormalizedProfileId(job.getId())
                    .orElseThrow(() -> new IllegalStateException("Job without candidate link"));
            CandidateProfileResponse profile = candidateService.getProfile(candidateId);
            ParseContext context = referenceContextBuilder.build();
            String canonical = profileNormalizeClient.normalize(new NormalizeRequest(profile, context));
            LocalDateTime now = LocalDateTime.now();
            transactionTemplate.executeWithoutResult(txStatus -> {
                normalizedProfileRepository.setContent(job.getId(), canonical, now);
                normalizationJobRepository.casDone(job.getId(),
                        NormalizationJobStatus.RUNNING, NormalizationJobStatus.DONE, now);
            });
            log.info("Profile normalization done : jobId={}, candidateId={}", job.getId(), candidateId);
        } catch (AiServiceException ex) {
            log.warn("Profile normalization failed : jobId={}, status={}, detail={}",
                    job.getId(), ex.getStatus(), ex.getMessage());
            retryOrFail(job, ex.getMessage());
        } catch (Exception ex) {
            log.error("Profile normalization unexpected error : jobId={}", job.getId(), ex);
            retryOrFail(job, "Unexpected error during normalization");
        } finally {
            MDC.remove(RequestLoggingFilter.CORRELATION_ID);
        }
    }

    /** Échec courant : replanifie (backoff) ou abandonne après {@link #MAX_ATTEMPTS}. */
    private void retryOrFail(NormalizationJob job, String message) {
        String error = truncate(message);
        int attempts = job.getAttempts() + 1;
        LocalDateTime now = LocalDateTime.now();
        if (attempts >= MAX_ATTEMPTS) {
            transactionTemplate.executeWithoutResult(txStatus ->
                    normalizationJobRepository.casFail(job.getId(), NormalizationJobStatus.RUNNING,
                            NormalizationJobStatus.FAILED, attempts, now, error));
            log.warn("Profile normalization abandoned after {} attempts : jobId={}, error={}",
                    attempts, job.getId(), error);
        } else {
            LocalDateTime nextAttemptAt = now.plusSeconds(RETRY_DELAY_SECONDS);
            transactionTemplate.executeWithoutResult(txStatus ->
                    normalizationJobRepository.casRetry(job.getId(), NormalizationJobStatus.RUNNING,
                            NormalizationJobStatus.PENDING, attempts, nextAttemptAt, error));
            log.info("Profile normalization scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}",
                    job.getId(), attempts, nextAttemptAt);
        }
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= ERROR_MAX_LENGTH ? message : message.substring(0, ERROR_MAX_LENGTH);
    }
}
