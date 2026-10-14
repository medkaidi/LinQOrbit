package com.linqorbit.joboffer.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.NormalizedProfileJobOffer;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Normalisation d'une offre d'emploi : création du couple profil + job sous
 * lock pessimiste de la ligne offre, et dirty-flag lu par le GET des offres.
 * Miroir de {@code NormalizationService} côté candidat — même machine, autre
 * source (association {@code normalized_profile_job_offer}, jobs
 * {@code source_type = OFFER}).
 *
 * <p>Appelé par {@code JobOfferService.validate} après la transition de
 * statut, dans la même tx : la validation est l'acte explicite qui déclenche
 * la normalisation (Save ≠ Validate). Après l'INSERT du job, un
 * {@link JobOfferValidatedEvent} est publié : le worker unique le consomme
 * <b>après commit</b> et lance l'exécution immédiatement (aucun
 * polling).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JobOfferNormalizationService {

    /** Version du format canonique offre (miroir de schema_version / schemaVersion). */
    static final String SCHEMA_VERSION = "2";

    private final JobOfferRepository jobOfferRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final NormalizationJobRepository normalizationJobRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Dirty-flag : aucune validation encore, ou la dernière écriture de
     * l'offre est postérieure à la dernière validation. Dérivé (pas de
     * colonne is_current). La validation elle-même ne touche jamais
     * {@code updatedAt} (Save ≠ Validate, miroir candidat) : un double-clic
     * sur Validate retombe sur le no-op.
     */
    public boolean hasUnvalidatedChanges(JobOffer offer) {
        LocalDateTime lastValidatedAt = normalizedProfileJobOfferRepository
                .findMaxValidatedAtByOfferId(offer.getId());
        return lastValidatedAt == null || offer.getUpdatedAt().isAfter(lastValidatedAt);
    }

    /**
     * Validation explicite de l'offre : no-op si rien n'a changé depuis la
     * dernière validation (double-clic, re-POST), sauf relance d'un job
     * FAILED. Le lock pessimiste de la ligne offre sérialise les validations
     * concurrentes d'une même offre. Miroir strict du candidat
     * ({@code NormalizationService.validateProfile}) : une édition pendant
     * une analyse en vol crée la version suivante (les PENDING sont
     * supersédés, un RUNNING antérieur termine sur sa propre version).
     */
    @Transactional
    public void onValidated(UUID offerId) {
        JobOffer offer = jobOfferRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new JobOfferNotFoundException(offerId));
        NormalizationJobStatus latestStatus = latestJobStatus(offerId);
        if (!hasUnvalidatedChanges(offer) && latestStatus != NormalizationJobStatus.FAILED) {
            log.info("Job offer normalization skipped : no change since last validation,"
                    + " offerId={}, latestStatus={}", offerId, latestStatus);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Integer maxVersion = normalizedProfileJobOfferRepository.findMaxVersionByOfferId(offerId);
        int version = (maxVersion == null ? 0 : maxVersion) + 1;
        int superseded = normalizedProfileJobOfferRepository.supersedeForOffer(offerId,
                NormalizationJobStatus.PENDING, NormalizationJobStatus.SUPERSEDED);

        UUID profileId = UUID.randomUUID();
        normalizedProfileRepository.save(NormalizedProfile.builder()
                .id(profileId)
                .version(version)
                .schemaVersion(SCHEMA_VERSION)
                .validatedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build());
        normalizedProfileJobOfferRepository.save(NormalizedProfileJobOffer.builder()
                .normalizedProfileId(profileId)
                .jobOfferId(offerId)
                .build());
        normalizationJobRepository.save(NormalizationJob.builder()
                .id(profileId)
                .status(NormalizationJobStatus.PENDING)
                .sourceType(NormalizationSourceType.OFFER)
                .attempts(0)
                .nextAttemptAt(now)
                .createdAt(now)
                .build());

        log.info("Job offer normalization registered : offerId={}, version={}, supersededPending={}, jobId={}",
                offerId, version, superseded, profileId);
        eventPublisher.publishEvent(new JobOfferValidatedEvent(profileId));
    }

    /** État du job de la dernière version de l'offre, ou {@code null} si aucune validation. */
    private NormalizationJobStatus latestJobStatus(UUID offerId) {
        List<NormalizedProfile> latest = normalizedProfileJobOfferRepository
                .findLatestByOfferId(offerId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            return null;
        }
        return normalizationJobRepository.findById(latest.get(0).getId())
                .map(NormalizationJob::getStatus)
                .orElse(null);
    }
}
