package com.linqorbit.joboffer.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.entity.NormalizedProfileSchemaVersions;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.service.NormalizationStatusBroadcaster;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
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

    private final JobOfferRepository jobOfferRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final NormalizationJobRepository normalizationJobRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final NormalizationStatusBroadcaster statusBroadcaster;

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
     * Offres dont l'analyse est obsolète (D63) : la fiche de référence —
     * dernière version AVEC contenu — porte un {@code schema_version}
     * différent de la version offre attendue. Une offre sans fiche n'y figure
     * jamais. Une seule requête pour toute une liste.
     */
    public Set<UUID> findOutdatedOfferIds(List<UUID> offerIds) {
        Set<UUID> outdated = new HashSet<>();
        if (offerIds.isEmpty()) {
            return outdated;
        }
        for (Object[] row : normalizedProfileJobOfferRepository.findCurrentSheetSchemaVersions(offerIds)) {
            if (!NormalizedProfileSchemaVersions.OFFER.equals(row[1])) {
                outdated.add((UUID) row[0]);
            }
        }
        return outdated;
    }

    /**
     * Instantané de la dernière analyse de chaque offre (D90) : une requête
     * pour les dernières versions + une pour les fiches de référence, jamais de
     * N+1. Une offre sans version est absente de la map ({@link
     * OfferAnalysisState#NONE}). Source unique des signaux de la liste, du
     * détail et de la décision de {@link #onValidated}.
     */
    public Map<UUID, OfferAnalysisState> analysisStates(List<UUID> offerIds) {
        if (offerIds.isEmpty()) {
            return Map.of();
        }
        Set<UUID> staleSchema = findOutdatedOfferIds(offerIds);
        Map<UUID, OfferAnalysisState> states = new HashMap<>();
        for (Object[] row : normalizedProfileJobOfferRepository.findLatestAnalyses(offerIds)) {
            UUID offerId = (UUID) row[0];
            states.put(offerId, new OfferAnalysisState(true, (NormalizationJobStatus) row[1],
                    Boolean.TRUE.equals(row[2]), staleSchema.contains(offerId)));
        }
        return states;
    }

    /**
     * Validation explicite de l'offre, autorisée si {@code dirty || failed ||
     * analysisOutdated} (D63, D90) : no-op sinon (double-clic, re-POST).
     * Appelée par {@code validate} (DRAFT/VALIDATED) et par {@code revalidate}
     * (PUBLISHED, rafraîchissement sans changement de cycle de vie) ; le
     * dirty-flag ne compte que sur un statut éditable. {@code analysisOutdated}
     * est celui de {@link OfferAnalysisState} — le même que celui exposé par
     * l'API : schéma périmé ou, sur une offre PUBLISHED, dernière analyse
     * inexploitable (aucune fiche, contenu absent). Il ne relance jamais une
     * analyse déjà en cours (PENDING/RUNNING). Le lock pessimiste de la ligne
     * offre sérialise les validations concurrentes d'une même offre : la
     * seconde voit la version PENDING de la première. Miroir strict du
     * candidat ({@code NormalizationService.validateProfile}) : une édition
     * pendant une analyse en vol crée la version suivante (les PENDING sont
     * supersédés, un RUNNING antérieur termine sur sa propre version).
     */
    @Transactional
    public void onValidated(UUID offerId) {
        JobOffer offer = jobOfferRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new JobOfferNotFoundException(offerId));
        OfferAnalysisState state = analysisStates(List.of(offerId))
                .getOrDefault(offerId, OfferAnalysisState.NONE);
        // D13 : le dirty-flag n'a de sens que sur un statut éditable — publish
        // pose updatedAt après validatedAt, une offre PUBLISHED (revalidate)
        // serait sinon toujours « sale ». Miroir du signal exposé par l'API.
        boolean dirty = (offer.getStatus() == JobOfferStatus.DRAFT || offer.getStatus() == JobOfferStatus.VALIDATED)
                && hasUnvalidatedChanges(offer);
        boolean failed = state.failed();
        boolean outdated = state.repairable(offer.getStatus());
        if (!dirty && !outdated && !failed) {
            log.info("Job offer normalization skipped : no change since last validation,"
                    + " offerId={}, latestStatus={}", offerId, state.latestStatus());
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
                .schemaVersion(NormalizedProfileSchemaVersions.OFFER)
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

        log.info("Job offer normalization registered : offerId={}, version={}, dirty={}, outdated={}, failed={},"
                + " unusable={}, supersededPending={}, jobId={}",
                offerId, version, dirty, outdated, failed, state.unusable(), superseded, profileId);
        eventPublisher.publishEvent(new JobOfferValidatedEvent(profileId));
    }

    /**
     * Flux SSE du statut de normalisation de l'offre (D64). L'accès (membre
     * de la company) est contrôlé par l'appelant ({@code JobOfferService}) ;
     * inscription d'abord, puis relecture du statut du dernier job.
     */
    public SseEmitter subscribe(UUID offerId) {
        return statusBroadcaster.subscribe(NormalizationStatusBroadcaster.Stream.offer(offerId),
                () -> latestJobStatus(offerId));
    }

    /**
     * État du job de la dernière version de l'offre, ou {@code null} si
     * aucune validation (jamais {@code SUPERSEDED}).
     */
    public NormalizationJobStatus latestJobStatus(UUID offerId) {
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
