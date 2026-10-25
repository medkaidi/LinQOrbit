package com.linqorbit.screening.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.screening.dto.ScreeningSignal;
import com.linqorbit.screening.entity.ScreeningJob;
import com.linqorbit.screening.entity.ScreeningJobStatus;
import com.linqorbit.screening.exception.InvalidScreeningException;
import com.linqorbit.screening.repository.ScreeningJobRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Cycle de vie des jobs de screening d'une offre publiée (T-101, D85) :
 * création aux deux déclencheurs <b>poussés</b> et relance manuelle.
 *
 * <ul>
 *   <li>{@link #onPublished} — dans la transaction de publication : le job
 *       est créé avec l'offre ; prêt à s'exécuter si le vecteur de sa fiche
 *       existe, sinon il attend l'embedding ;</li>
 *   <li>{@link #onOfferEmbeddingDone} — fin de l'embedding d'une fiche
 *       d'offre : crée le job manquant (offre publiée sans fiche à la
 *       publication, fiche remplacée) ou libère le job en attente.</li>
 * </ul>
 *
 * <p>Le résultat est un <b>instantané pris à la publication</b> : une offre
 * qui a déjà un screening {@code DONE} n'en reçoit jamais un second (une
 * nouvelle fiche d'offre ne rafraîchit pas la liste affichée). Seule la
 * relance d'un échec ({@link #retry}) est possible, à la main.</p>
 *
 * <p>Création et relance publient un {@link ScreeningJobChangedEvent} traité
 * après commit : exécution du worker et signal SSE.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScreeningJobService {

    private final ScreeningJobRepository screeningJobRepository;
    private final JobOfferRepository jobOfferRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final ScreeningService screeningService;
    private final ScreeningWorker screeningWorker;
    private final ScreeningStatusPublisher statusPublisher;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;

    /**
     * Appelée par la publication, dans sa transaction (verrou de l'offre
     * détenu). Une offre sans fiche (analyse à générer) n'a pas encore de
     * screening : il naîtra à la fin de l'embedding de sa fiche.
     */
    @Transactional
    public void onPublished(UUID offerId) {
        normalizedProfileJobOfferRepository.findLatestWithContentByOfferId(offerId, PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(NormalizedProfile::getId)
                .ifPresentOrElse(profileId -> ensureJob(offerId, profileId),
                        () -> log.info("Screening not started at publication : no analysis yet, offerId={}",
                                offerId));
    }

    /**
     * Appelée par l'embedding après l'écriture du vecteur d'une fiche. Sans
     * effet pour une fiche de candidat ou une offre non publiée/expirée.
     * <b>N'échoue jamais</b> : une panne de screening ne doit pas faire
     * échouer un embedding valide.
     */
    public void onOfferEmbeddingDone(UUID profileId) {
        try {
            normalizedProfileJobOfferRepository.findOfferIdByNormalizedProfileId(profileId)
                    .flatMap(jobOfferRepository::findById)
                    .filter(ScreeningJobService::isOpen)
                    .ifPresent(offer -> transactionTemplate.executeWithoutResult(
                            status -> ensureJob(offer.getId(), profileId)));
        } catch (RuntimeException ex) {
            log.error("Screening trigger failed after embedding : profileId={}", profileId, ex);
        }
    }

    /**
     * Relance manuelle d'un screening échoué : {@code FAILED → PENDING},
     * tentatives remises à zéro, même ligne. Tout autre état (y compris
     * {@code DONE}) est refusé : une liste affichée n'est jamais rafraîchie.
     */
    @Transactional
    public ScreeningSignal retry(JobOffer offer) {
        if (!isOpen(offer)) {
            throw new InvalidScreeningException(HttpStatus.CONFLICT,
                    "The search can only be retried while the offer is published.");
        }
        ScreeningJob job = screeningJobRepository.findLatestVisible(offer.getId(), ScreeningJobStatus.SUPERSEDED)
                .orElse(null);
        if (job == null || job.getStatus() != ScreeningJobStatus.FAILED) {
            log.warn("Screening retry rejected : offerId={}, status={}", offer.getId(),
                    job == null ? "none" : job.getStatus().getApiValue());
            throw new InvalidScreeningException(HttpStatus.CONFLICT,
                    "Only a failed search can be retried.");
        }
        int requeued = screeningJobRepository.casRequeue(job.getId(), ScreeningJobStatus.FAILED,
                ScreeningJobStatus.PENDING, LocalDateTime.now());
        if (requeued != 1) {
            throw new InvalidScreeningException(HttpStatus.CONFLICT, "Only a failed search can be retried.");
        }
        log.info("Screening retry requested : offerId={}, jobId={}", offer.getId(), job.getId());
        eventPublisher.publishEvent(new ScreeningJobChangedEvent(job.getId(), true));
        return new ScreeningSignal(ScreeningJobStatus.PENDING.getApiValue(), null);
    }

    /** Après commit : signal SSE puis exécution. Une erreur ici ne remonte jamais à la transaction métier. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onJobChanged(ScreeningJobChangedEvent event) {
        try {
            statusPublisher.publish(event.jobId());
            if (event.dispatch()) {
                screeningWorker.dispatch(event.jobId());
            }
        } catch (RuntimeException ex) {
            log.error("Screening job notification failed : jobId={} — boot recovery will pick it up",
                    event.jobId(), ex);
        }
    }

    /**
     * Crée (si absent) le job de la fiche d'offre, supersède les jobs en
     * attente d'une autre fiche, puis annonce le job. Rien si l'offre a déjà
     * son instantané ({@code DONE}).
     */
    private void ensureJob(UUID offerId, UUID profileId) {
        if (screeningJobRepository.existsByJobOfferIdAndStatus(offerId, ScreeningJobStatus.DONE)) {
            log.debug("Screening already done, not restarted : offerId={}", offerId);
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        screeningJobRepository.insertPendingIfAbsent(UUID.randomUUID(), offerId, profileId, now);
        screeningJobRepository.supersedeOtherJobs(offerId, profileId, ScreeningJobStatus.PENDING,
                ScreeningJobStatus.SUPERSEDED, now);
        ScreeningJob job = screeningJobRepository.findByOfferNormalizedProfileId(profileId).orElse(null);
        if (job == null || job.getStatus() != ScreeningJobStatus.PENDING) {
            return;
        }
        boolean ready = screeningService.hasCurrentOfferVector(offerId);
        log.info("Screening job registered : offerId={}, jobId={}, ready={}", offerId, job.getId(), ready);
        eventPublisher.publishEvent(new ScreeningJobChangedEvent(job.getId(), ready));
    }

    private static boolean isOpen(JobOffer offer) {
        return offer.getStatus() == JobOfferStatus.PUBLISHED
                && (offer.getExpiresAt() == null || !offer.getExpiresAt().isBefore(LocalDate.now()));
    }
}
