package com.linqorbit.candidate.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
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
import com.linqorbit.candidate.client.ProfileNormalizeClient;
import com.linqorbit.candidate.client.ReferenceContextBuilder;
import com.linqorbit.candidate.entity.NormalizationJobStatus;

/**
 * Exécution asynchrone des jobs de normalisation, <b>déclenchée uniquement par
 * une validation utilisateur</b> — aucun polling. L'événement de validation est
 * consommé après commit, le job est soumis à un pool dédié ; les retries sont
 * des one-shot sur un scheduler dédié (échéance {@code next_attempt_at}) ; la
 * récupération au démarrage reprend les orphelins de crash.
 *
 * <p>Toutes les transitions passent par un CAS {@code WHERE status = :expected}
 * : un job exécuté l'est une seule fois, un job {@code SUPERSEDED},
 * {@code DONE} ou {@code FAILED} ne l'est jamais (le claim exige
 * {@code PENDING}). {@code attempts} compte les échecs cumulés : exécution
 * initiale + 2 retries = 3 exécutions au total, jamais une quatrième
 * ({@code FAILED} est terminal pour un job).</p>
 *
 * <p>Timeouts : le read timeout du client IA libère le thread de l'exécution ;
 * il n'annule pas le calcul côté FastAPI/LLM (réponse tardive perdue sur la
 * socket fermée, corrélation {@code X-Request-Id} = jobId) — voir
 * {@code AiClientConfig}. Un RUNNING légitime ne dépasse donc jamais ~2 min,
 * très loin du seuil de stale de 10 minutes.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NormalizationWorker {

    /** Exécutions totales autorisées par job : initiale + 2 retries. */
    static final int MAX_ATTEMPTS = 3;
    /** Un RUNNING plus vieux que ce seuil est considéré orphelin (worker mort). */
    static final int STALE_RUNNING_MINUTES = 10;
    /** Taille max de la colonne normalization_job.error. */
    private static final int ERROR_MAX_LENGTH = 500;

    @Qualifier("normalizationExecutor")
    private final ThreadPoolTaskExecutor normalizationExecutor;
    @Qualifier("normalizationTaskScheduler")
    private final TaskScheduler normalizationTaskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final NormalizationJobRepository normalizationJobRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private final CandidateService candidateService;
    private final ReferenceContextBuilder referenceContextBuilder;
    private final ProfileNormalizeClient profileNormalizeClient;
    @Value("${app.normalization.retry-delay-seconds}")
    private final int retryDelaySeconds;

    /** Après commit d'une validation : soumission immédiate au pool dédié. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onProfileValidated(ProfileValidatedEvent event) {
        dispatch(event.jobId());
    }

    /**
     * Récupération au démarrage (seul « filet » du système, pas de scan en
     * fonctionnement) : RUNNING périmés → replanifiés ; PENDING dûs →
     * exécutés ; PENDING dont le retry n'est pas échu → planifiés à leur
     * échéance. Les statuts terminaux ne sont jamais touchés ; un job exécuté
     * ici repasse par le claim CAS.
     */
    @EventListener(ApplicationReadyEvent.class)
    void recoverOrphanJobs() {
        try {
            Set<UUID> handled = new HashSet<>();
            recoverStaleRunningJobs(handled);
            redispatchPendingJobs(handled);
        } catch (Exception ex) {
            log.error("Normalization boot recovery failed", ex);
        }
    }

    private void recoverStaleRunningJobs(Set<UUID> handled) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(STALE_RUNNING_MINUTES);
        List<NormalizationJob> stale = normalizationJobRepository
                .findByStatusAndStartedAtLessThanEqual(NormalizationJobStatus.RUNNING, threshold);
        for (NormalizationJob job : stale) {
            log.warn("Recovering stale RUNNING normalization job : jobId={}, startedAt={}",
                    job.getId(), job.getStartedAt());
            retryOrFail(job, "Worker presumed dead before completion");
            handled.add(job.getId());
        }
    }

    private void redispatchPendingJobs(Set<UUID> handled) {
        LocalDateTime now = LocalDateTime.now();
        for (NormalizationJob job : normalizationJobRepository.findByStatus(NormalizationJobStatus.PENDING)) {
            if (handled.contains(job.getId())) {
                continue;
            }
            if (job.getNextAttemptAt().isAfter(now)) {
                log.info("Rescheduling pending normalization job : jobId={}, nextAttemptAt={}",
                        job.getId(), job.getNextAttemptAt());
                scheduleAt(job.getId(), job.getNextAttemptAt());
            } else {
                dispatch(job.getId());
            }
        }
    }

    /**
     * Soumet l'exécution au pool ; si la soumission échoue (queue saturée),
     * planifie une re-soumission — le job reste PENDING et ne peut pas rester
     * invisible : soit le scheduler le reprend, soit le recovery au
     * démarrage.
     */
    private void dispatch(UUID jobId) {
        try {
            normalizationExecutor.execute(() -> executeJob(jobId));
        } catch (RuntimeException ex) {
            log.error("Normalization job submission failed, scheduling a re-submission : jobId={}",
                    jobId, ex);
            try {
                scheduleAt(jobId, LocalDateTime.now().plusSeconds(retryDelaySeconds));
            } catch (RuntimeException scheduleEx) {
                log.error("Normalization job re-submission scheduling failed : jobId={} — job stays "
                        + "PENDING, boot recovery will pick it up", jobId, scheduleEx);
            }
        }
    }

    private void scheduleAt(UUID jobId, LocalDateTime at) {
        normalizationTaskScheduler.schedule(() -> executeJob(jobId), instantOf(at));
    }

    /** Claim CAS puis exécution : appel IA hors tx, fin de vie en txs courtes. */
    void executeJob(UUID jobId) {
        try {
            NormalizationJob job = claim(jobId);
            if (job == null) {
                return;
            }
            MDC.put(RequestLoggingFilter.CORRELATION_ID, jobId.toString());
            try {
                execute(job);
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
        } catch (Exception ex) {
            log.error("Normalization job execution failed unexpectedly : jobId={}", jobId, ex);
        }
    }

    /** Tx courte : CAS PENDING→RUNNING, un seul vainqueur ; null si inéxécutable. */
    private NormalizationJob claim(UUID jobId) {
        return transactionTemplate.execute(status -> {
            int claimed = normalizationJobRepository.casStatus(jobId,
                    NormalizationJobStatus.PENDING, NormalizationJobStatus.RUNNING, LocalDateTime.now());
            if (claimed != 1) {
                log.debug("Normalization job not claimable (superseded, done or failed) : jobId={}", jobId);
                return null;
            }
            return normalizationJobRepository.findById(jobId).orElse(null);
        });
    }

    /** Appel IA hors tx ; écriture du contenu + DONE en une tx courte. */
    private void execute(NormalizationJob job) {
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
    }

    /**
     * Échec courant : replanifie (one-shot à {@code retryDelaySeconds}) tant
     * que le total reste sous {@link #MAX_ATTEMPTS} exécutions, sinon
     * abandonne en {@code FAILED} (relançable par une nouvelle validation,
     * qui crée un nouveau job).
     */
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
            return;
        }
        LocalDateTime nextAttemptAt = now.plusSeconds(retryDelaySeconds);
        transactionTemplate.executeWithoutResult(txStatus ->
                normalizationJobRepository.casRetry(job.getId(), NormalizationJobStatus.RUNNING,
                        NormalizationJobStatus.PENDING, attempts, nextAttemptAt, error));
        log.info("Profile normalization scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}",
                job.getId(), attempts, nextAttemptAt);
        try {
            normalizationTaskScheduler.schedule(() -> executeJob(job.getId()), instantOf(nextAttemptAt));
        } catch (RuntimeException ex) {
            log.error("Normalization retry scheduling failed : jobId={} — job stays PENDING, "
                    + "boot recovery will pick it up", job.getId(), ex);
        }
    }

    private static Instant instantOf(LocalDateTime at) {
        return at.atZone(ZoneId.systemDefault()).toInstant();
    }

    private static String truncate(String message) {
        if (message == null) {
            return null;
        }
        return message.length() <= ERROR_MAX_LENGTH ? message : message.substring(0, ERROR_MAX_LENGTH);
    }
}
