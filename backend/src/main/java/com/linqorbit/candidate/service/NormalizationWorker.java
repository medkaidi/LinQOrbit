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
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.client.ProfileNormalizeClient;
import com.linqorbit.candidate.client.ReferenceContextBuilder;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.NormalizeRequest;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.dto.ProfileLocation;
import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.entity.NormalizedProfileSchemaVersions;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.common.logging.RequestLoggingFilter;
import com.linqorbit.embedding.service.EmbeddingService;
import com.linqorbit.joboffer.client.JobOfferNormalizeClient;
import com.linqorbit.joboffer.dto.OfferNormalizeRequest;
import com.linqorbit.joboffer.dto.OfferSnapshot;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferNormalizeSnapshotBuilder;
import com.linqorbit.joboffer.service.JobOfferValidatedEvent;
import com.linqorbit.user.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

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
 * <p>Le worker est <b>unique</b> pour les deux sources (D27) : après le
 * claim, il branche sur {@code source_type} (snapshot et client IA dédiés
 * par source). Claim, retries, recovery et écriture DONE sont partagés —
 * seule la construction du snapshot et l'appel IA diffèrent.</p>
 *
 * <p>Garde de version (D63) : la ligne {@code normalized_profile} doit porter
 * la version courante de sa source avant l'appel IA, et le JSON IA doit
 * annoncer cette même version avant toute écriture de {@code content} —
 * sinon échec courant (retry puis {@code FAILED}), jamais une ligne
 * incohérente.</p>
 *
 * <p>Push SSE (D64) : chaque transition (RUNNING au claim, DONE, retry
 * PENDING, FAILED) est publiée <b>après</b> la fin de sa transaction courte
 * via {@link NormalizationStatusPublisher}, qui ne fait jamais échouer le
 * job.</p>
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
    private final UserRepository userRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final JobOfferRepository jobOfferRepository;
    private final JobOfferNormalizeSnapshotBuilder jobOfferNormalizeSnapshotBuilder;
    private final JobOfferNormalizeClient jobOfferNormalizeClient;
    private final ObjectMapper objectMapper;
    private final NormalizationStatusPublisher statusPublisher;
    private final EmbeddingService embeddingService;
    @Value("${app.normalization.retry-delay-seconds}")
    private final int retryDelaySeconds;

    /** Après commit d'une validation : soumission immédiate au pool dédié. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onProfileValidated(ProfileValidatedEvent event) {
        dispatch(event.jobId());
    }

    /** Après commit d'une validation d'offre : même soumission, même pool. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onJobOfferValidated(JobOfferValidatedEvent event) {
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

    /**
     * One-shot à l'échéance : le scheduler ne fait que soumettre au pool dédié
     * (jamais l'appel IA de ~20 s sur son thread unique, qui bloquerait les
     * autres retries planifiés) ; le claim CAS garantit qu'une exécution
     * tardive d'un job terminal reste sans effet.
     */
    private void scheduleAt(UUID jobId, LocalDateTime at) {
        try {
            normalizationTaskScheduler.schedule(() -> dispatch(jobId), instantOf(at));
        } catch (RuntimeException ex) {
            log.error("Normalization scheduling failed : jobId={} — job stays PENDING, "
                    + "boot recovery will pick it up", jobId, ex);
        }
    }

    /** Claim CAS puis exécution : appel IA hors tx, fin de vie en txs courtes. */
    void executeJob(UUID jobId) {
        try {
            NormalizationJob job = claim(jobId);
            if (job == null) {
                return;
            }
            MDC.put(RequestLoggingFilter.CORRELATION_ID, jobId.toString());
            statusPublisher.publish(job.getId(), job.getSourceType());
            try {
                if (job.getSourceType() == NormalizationSourceType.OFFER) {
                    executeOffer(job);
                } else {
                    executeCandidate(job);
                }
            } catch (AiServiceException ex) {
                log.warn("Normalization failed : jobId={}, status={}, detail={}",
                        job.getId(), ex.getStatus(), ex.getMessage());
                retryOrFail(job, ex.getMessage());
            } catch (Exception ex) {
                log.error("Normalization unexpected error : jobId={}", job.getId(), ex);
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
    private void executeCandidate(NormalizationJob job) {
        String expectedVersion = requireRowOnCurrentSchema(job);
        UUID candidateId = normalizedProfileCandidateRepository
                .findCandidateIdByNormalizedProfileId(job.getId())
                .orElseThrow(() -> new IllegalStateException("Job without candidate link"));
        CandidateProfileResponse profile = candidateService.getProfile(candidateId);
        ProfileLocation location = userRepository.findById(candidateId)
                .map(user -> new ProfileLocation(user.getCurrentCity(), user.getCurrentCountry()))
                .orElseGet(() -> new ProfileLocation(null, null));
        ParseContext context = referenceContextBuilder.build();
        String canonical = profileNormalizeClient.normalize(new NormalizeRequest(profile, location, context));
        requireSchemaVersion(canonical, expectedVersion);
        LocalDateTime now = LocalDateTime.now();
        transactionTemplate.executeWithoutResult(txStatus -> {
            normalizedProfileRepository.setContent(job.getId(), canonical, now);
            normalizationJobRepository.casDone(job.getId(),
                    NormalizationJobStatus.RUNNING, NormalizationJobStatus.DONE, now);
        });
        statusPublisher.publish(job.getId(), job.getSourceType());
        triggerEmbedding(job.getId());
        log.info("Profile normalization done : jobId={}, candidateId={}", job.getId(), candidateId);
    }

    /**
     * Branche offre : snapshot de l'offre (description HTML déjà strippée par
     * le builder) + contexte référentiel → POST /job-offer/normalize, puis
     * écriture du contenu + DONE en une tx (même machine que le candidat).
     */
    private void executeOffer(NormalizationJob job) {
        String expectedVersion = requireRowOnCurrentSchema(job);
        UUID offerId = normalizedProfileJobOfferRepository
                .findOfferIdByNormalizedProfileId(job.getId())
                .orElseThrow(() -> new IllegalStateException("Job without offer link"));
        JobOffer offer = jobOfferRepository.findById(offerId)
                .orElseThrow(() -> new IllegalStateException("Job without offer"));
        OfferSnapshot snapshot = jobOfferNormalizeSnapshotBuilder.build(offer);
        ParseContext context = referenceContextBuilder.buildForOffer();
        String canonical = jobOfferNormalizeClient
                .normalize(new OfferNormalizeRequest(snapshot, context));
        requireSchemaVersion(canonical, expectedVersion);
        LocalDateTime now = LocalDateTime.now();
        transactionTemplate.executeWithoutResult(txStatus -> {
            normalizedProfileRepository.setContent(job.getId(), canonical, now);
            normalizationJobRepository.casDone(job.getId(),
                    NormalizationJobStatus.RUNNING, NormalizationJobStatus.DONE, now);
        });
        statusPublisher.publish(job.getId(), job.getSourceType());
        triggerEmbedding(job.getId());
        log.info("Offer normalization done : jobId={}, offerId={}", job.getId(), offerId);
    }

    /**
     * Déclenche l'embedding de la fiche qui vient d'être normalisée. La
     * normalisation est déjà commitée : aucune erreur d'embedding ne doit la
     * faire passer pour un échec (retry, statut) — le backfill recrée un job
     * manquant.
     */
    private void triggerEmbedding(UUID profileId) {
        try {
            embeddingService.enqueueAndDispatch(profileId);
        } catch (RuntimeException ex) {
            log.error("Embedding trigger failed : profileId={} — the normalization is kept, the backfill "
                    + "will recreate the job", profileId, ex);
        }
    }

    /**
     * La ligne {@code normalized_profile} garde la version posée à sa
     * validation (immuable) : un job validé sous une autre version (montée de
     * version pendant qu'il attendait, reprise au boot) n'écrit jamais un
     * contenu au format courant dans une ligne qui en annonce un autre —
     * échec avant tout appel IA. Retourne la version attendue de la source.
     */
    private String requireRowOnCurrentSchema(NormalizationJob job) {
        String expected = NormalizedProfileSchemaVersions.of(job.getSourceType());
        String rowVersion = normalizedProfileRepository.findById(job.getId())
                .map(NormalizedProfile::getSchemaVersion)
                .orElseThrow(() -> new IllegalStateException("Job without normalized profile"));
        if (!expected.equals(rowVersion)) {
            throw new IllegalStateException("Normalized profile validated on schema " + rowVersion
                    + ", current is " + expected);
        }
        return expected;
    }

    /**
     * Garde D63 : le JSON IA doit annoncer la version attendue de sa source
     * AVANT toute écriture de {@code content}. Version absente, différente ou
     * JSON illisible → échec courant (retry puis {@code FAILED}).
     */
    private void requireSchemaVersion(String canonical, String expected) {
        String actual = null;
        if (canonical != null) {
            try {
                JsonNode version = objectMapper.readTree(canonical).path("schemaVersion");
                actual = version.isString() ? version.asString() : null;
            } catch (JacksonException ex) {
                actual = null;
            }
        }
        if (!expected.equals(actual)) {
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service returned schemaVersion " + actual + ", expected " + expected + ".");
        }
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
            statusPublisher.publish(job.getId(), job.getSourceType());
            log.warn("Normalization abandoned after {} attempts : jobId={}, error={}",
                    attempts, job.getId(), error);
            return;
        }
        LocalDateTime nextAttemptAt = now.plusSeconds(retryDelaySeconds);
        transactionTemplate.executeWithoutResult(txStatus ->
                normalizationJobRepository.casRetry(job.getId(), NormalizationJobStatus.RUNNING,
                        NormalizationJobStatus.PENDING, attempts, nextAttemptAt, error));
        statusPublisher.publish(job.getId(), job.getSourceType());
        log.info("Normalization scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}",
                job.getId(), attempts, nextAttemptAt);
        scheduleAt(job.getId(), nextAttemptAt);
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
