package com.linqorbit.screening.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
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
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.common.logging.RequestLoggingFilter;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;
import com.linqorbit.invitation.entity.OfferCandidate;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.screening.dto.ScreenedCandidate;
import com.linqorbit.screening.entity.ScreeningJob;
import com.linqorbit.screening.entity.ScreeningJobStatus;
import com.linqorbit.screening.repository.ScreeningJobRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Exécution asynchrone des jobs de screening (T-101, D85), miroir de
 * {@code EmbeddingWorker} : exécution <b>poussée</b> (publication de l'offre
 * ou fin de l'embedding de sa fiche — aucun polling), pool et scheduler
 * dédiés, claim par CAS {@code PENDING→RUNNING} (un job n'est exécuté
 * qu'une fois), et écriture des suggestions + {@code DONE} en <b>une</b>
 * transaction.
 *
 * <p>Avant tout calcul : une offre qui n'est plus publiée (ou expirée), ou
 * dont la fiche n'est plus la fiche courante, passe {@code SUPERSEDED} sans
 * calcul ; une offre dont le vecteur n'existe pas encore repasse
 * {@code PENDING} sans consommer de tentative (l'embedding la relancera).</p>
 *
 * <p>Relance du calcul : les suggestions {@code SUGGESTED} sont remplacées,
 * les {@code INVITED} conservées (et exclues du Top N). Échecs : 3
 * exécutions au total puis {@code FAILED}, que seul le recruteur relance.
 * Chaque transition est publiée en SSE <b>après</b> son commit.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScreeningWorker {

    /** Exécutions totales autorisées par job : initiale + 2 retries. */
    static final int MAX_ATTEMPTS = 3;
    /** Un RUNNING plus vieux que ce seuil est considéré orphelin (worker mort). */
    static final int STALE_RUNNING_MINUTES = 10;
    /** Taille max de la colonne screening_job.error. */
    private static final int ERROR_MAX_LENGTH = 500;

    @Qualifier("screeningExecutor")
    private final ThreadPoolTaskExecutor screeningExecutor;
    @Qualifier("screeningTaskScheduler")
    private final TaskScheduler screeningTaskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final ScreeningJobRepository screeningJobRepository;
    private final OfferCandidateRepository offerCandidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final EmbeddingJobRepository embeddingJobRepository;
    private final ScreeningService screeningService;
    private final ScreeningStatusPublisher statusPublisher;
    @Value("${app.screening.retry-delay-seconds:30}")
    private final int retryDelaySeconds;

    /**
     * Seul « filet » du système, comme l'embedding : reprise des jobs orphelins
     * au démarrage. Aucun scan en fonctionnement.
     */
    @EventListener(ApplicationReadyEvent.class)
    void onStartup() {
        try {
            recoverOrphanJobs();
        } catch (Exception ex) {
            log.error("Screening boot recovery failed", ex);
        }
    }

    /**
     * Récupération au démarrage : RUNNING périmés → replanifiés ; PENDING dûs →
     * exécutés (un job sans vecteur d'offre se remet en attente), non échus →
     * planifiés à leur échéance. Les FAILED restent à la main du recruteur ;
     * DONE et SUPERSEDED ne sont jamais touchés.
     */
    void recoverOrphanJobs() {
        Set<UUID> handled = new HashSet<>();
        LocalDateTime now = LocalDateTime.now();
        List<ScreeningJob> stale = screeningJobRepository.findByStatusAndStartedAtLessThanEqual(
                ScreeningJobStatus.RUNNING, now.minusMinutes(STALE_RUNNING_MINUTES));
        for (ScreeningJob job : stale) {
            log.warn("Recovering stale RUNNING screening job : jobId={}, startedAt={}", job.getId(),
                    job.getStartedAt());
            retryOrFail(job, "Worker presumed dead before completion");
            handled.add(job.getId());
        }
        for (ScreeningJob job : screeningJobRepository.findByStatus(ScreeningJobStatus.PENDING)) {
            if (handled.contains(job.getId())) {
                continue;
            }
            if (job.getNextAttemptAt().isAfter(now)) {
                scheduleAt(job.getId(), job.getNextAttemptAt());
            } else {
                dispatch(job.getId());
            }
        }
    }

    /**
     * Soumet l'exécution au pool ; si la soumission échoue (queue saturée),
     * planifie une re-soumission — le job reste PENDING, jamais invisible.
     */
    void dispatch(UUID jobId) {
        try {
            screeningExecutor.execute(() -> executeJob(jobId));
        } catch (RuntimeException ex) {
            log.error("Screening job submission failed, scheduling a re-submission : jobId={}", jobId, ex);
            scheduleAt(jobId, LocalDateTime.now().plusSeconds(retryDelaySeconds));
        }
    }

    /** One-shot à l'échéance : le scheduler ne fait que soumettre au pool dédié. */
    private void scheduleAt(UUID jobId, LocalDateTime at) {
        try {
            screeningTaskScheduler.schedule(() -> dispatch(jobId), instantOf(at));
        } catch (RuntimeException ex) {
            log.error("Screening scheduling failed : jobId={} — job stays PENDING, boot recovery will "
                    + "pick it up", jobId, ex);
        }
    }

    /** Claim CAS puis exécution : fin de vie en transactions courtes, publication SSE après chaque commit. */
    void executeJob(UUID jobId) {
        try {
            ScreeningJob job = claim(jobId);
            if (job == null) {
                return;
            }
            statusPublisher.publish(jobId);
            MDC.put(RequestLoggingFilter.CORRELATION_ID, jobId.toString());
            try {
                run(job);
            } catch (Exception ex) {
                log.error("Screening unexpected error : jobId={}", job.getId(), ex);
                retryOrFail(job, "Unexpected error during screening");
            } finally {
                MDC.remove(RequestLoggingFilter.CORRELATION_ID);
            }
            statusPublisher.publish(jobId);
        } catch (Exception ex) {
            log.error("Screening job execution failed unexpectedly : jobId={}", jobId, ex);
        }
    }

    /** Tx courte : CAS PENDING→RUNNING, un seul vainqueur ; null si inexécutable. */
    private ScreeningJob claim(UUID jobId) {
        return transactionTemplate.execute(status -> {
            int claimed = screeningJobRepository.casStatus(jobId, ScreeningJobStatus.PENDING,
                    ScreeningJobStatus.RUNNING, LocalDateTime.now());
            if (claimed != 1) {
                log.debug("Screening job not claimable (done, failed, superseded or taken) : jobId={}", jobId);
                return null;
            }
            return screeningJobRepository.findById(jobId).orElse(null);
        });
    }

    private void run(ScreeningJob job) {
        UUID offerId = job.getJobOfferId();
        JobOffer offer = jobOfferRepository.findById(offerId).orElse(null);
        if (offer == null || !isOpen(offer)) {
            supersede(job, "offer no longer published");
            return;
        }
        if (!embeddingJobRepository.isCurrentProfile(job.getOfferNormalizedProfileId())) {
            supersede(job, "offer profile no longer current");
            return;
        }
        if (!screeningService.hasCurrentOfferVector(offerId)) {
            transactionTemplate.executeWithoutResult(status -> screeningJobRepository.casWait(job.getId(),
                    ScreeningJobStatus.RUNNING, ScreeningJobStatus.PENDING));
            log.info("Screening job waiting for the offer embedding : jobId={}, offerId={}", job.getId(), offerId);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Integer count = transactionTemplate.execute(status -> {
            // Les SUGGESTED d'un calcul précédent sont remplacés avant le Top N : les INVITED restent,
            // et la requête les exclut (aucun doublon, aucune invitation perdue).
            offerCandidateRepository.deleteByJobOfferIdAndStatus(offerId, OfferCandidateStatus.SUGGESTED);
            List<ScreenedCandidate> top = screeningService.topCandidates(offerId);
            List<OfferCandidate> rows = new ArrayList<>(top.size());
            int rank = 1;
            for (ScreenedCandidate candidate : top) {
                rows.add(OfferCandidate.builder()
                        .id(UUID.randomUUID())
                        .jobOfferId(offerId)
                        .candidateId(candidate.candidateId())
                        .candidateNormalizedProfileId(candidate.normalizedProfileId())
                        .screeningJobId(job.getId())
                        .rank(rank++)
                        .distance(candidate.distance())
                        .status(OfferCandidateStatus.SUGGESTED)
                        .createdAt(now)
                        .build());
            }
            offerCandidateRepository.saveAll(rows);
            int total = Math.toIntExact(offerCandidateRepository.countByJobOfferId(offerId));
            int done = screeningJobRepository.casDone(job.getId(), ScreeningJobStatus.RUNNING,
                    ScreeningJobStatus.DONE, total, now);
            if (done != 1) {
                log.warn("Screening job finished but no longer RUNNING : jobId={}", job.getId());
                status.setRollbackOnly();
                return null;
            }
            return total;
        });
        if (count != null) {
            log.info("Screening done : jobId={}, offerId={}, candidates={}", job.getId(), offerId, count);
        }
    }

    private static boolean isOpen(JobOffer offer) {
        return offer.getStatus() == JobOfferStatus.PUBLISHED
                && (offer.getExpiresAt() == null || !offer.getExpiresAt().isBefore(LocalDate.now()));
    }

    private void supersede(ScreeningJob job, String reason) {
        transactionTemplate.executeWithoutResult(status -> screeningJobRepository.casSupersede(job.getId(),
                ScreeningJobStatus.RUNNING, ScreeningJobStatus.SUPERSEDED, LocalDateTime.now()));
        log.info("Screening job superseded without computation : jobId={}, reason={}", job.getId(), reason);
    }

    /**
     * Échec courant : replanifie (one-shot) tant que le total reste sous
     * {@link #MAX_ATTEMPTS} exécutions, sinon {@code FAILED}.
     */
    private void retryOrFail(ScreeningJob job, String message) {
        String error = truncate(message);
        int attempts = job.getAttempts() + 1;
        LocalDateTime now = LocalDateTime.now();
        if (attempts >= MAX_ATTEMPTS) {
            transactionTemplate.executeWithoutResult(status -> screeningJobRepository.casFail(job.getId(),
                    ScreeningJobStatus.RUNNING, ScreeningJobStatus.FAILED, attempts, now, error));
            log.warn("Screening abandoned after {} attempts : jobId={}, error={}", attempts, job.getId(), error);
            return;
        }
        LocalDateTime nextAttemptAt = now.plusSeconds(retryDelaySeconds);
        transactionTemplate.executeWithoutResult(status -> screeningJobRepository.casRetry(job.getId(),
                ScreeningJobStatus.RUNNING, ScreeningJobStatus.PENDING, attempts, nextAttemptAt, error));
        log.info("Screening scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}", job.getId(), attempts,
                nextAttemptAt);
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
