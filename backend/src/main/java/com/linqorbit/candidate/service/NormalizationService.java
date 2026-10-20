package com.linqorbit.candidate.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.entity.NormalizedProfileCandidate;
import com.linqorbit.candidate.entity.NormalizedProfileSchemaVersions;
import com.linqorbit.candidate.exception.EmptyProfileException;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Normalisation du profil candidat : validation explicite par l'utilisateur
 * (crée le couple profil + job sous lock pessimiste de la ligne candidat) et
 * dirty-flag lu par le GET du profil.
 *
 * <p>Enchaînement d'une validation, dans une seule tx : lock candidat →
 * dirty-check → numérotation de la version → supersede des jobs en attente →
 * INSERT profil (contenu NULL) + association + job PENDING. Jamais de job
 * sans profil : le profil porte la liaison vers le candidat.</p>
 *
 * <p>Le worker ({@code NormalizationWorker}) est le seul consommateur des
 * jobs ; cette classe ne fait que de l'orchestration de tx courtes. Après
 * l'INSERT du job, un {@link ProfileValidatedEvent} est publié : le worker le
 * consomme <b>après commit</b> et lance l'exécution immédiatement (aucun
 * polling).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NormalizationService {

    private final CandidateRepository candidateRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private final NormalizationJobRepository normalizationJobRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final NormalizationStatusBroadcaster statusBroadcaster;

    /**
     * Dirty-flag : aucune validation encore, ou la dernière écriture du profil
     * est postérieure à la dernière validation. Dérivé (pas de colonne
     * is_current) : le signal vit sur candidates.updated_at, alimenté par les
     * 7 écritures de section (heartbeat pour les sections filles).
     */
    public boolean hasUnvalidatedChanges(Candidate candidate) {
        LocalDateTime lastValidatedAt = normalizedProfileRepository
                .findMaxValidatedAtByCandidateId(candidate.getId());
        return lastValidatedAt == null || candidate.getUpdatedAt().isAfter(lastValidatedAt);
    }

    /**
     * True si le job de la dernière version du candidat est en échec définitif
     * (3 essais échoués) : signal exposé au GET du profil pour inviter l'utilisateur
     * à relancer. Le message d'erreur réel reste dans les logs (et la colonne
     * normalization_job.error), jamais dans l'API.
     */
    public boolean hasFailedLatestJob(UUID candidateId) {
        return latestJobStatus(candidateId) == NormalizationJobStatus.FAILED;
    }

    /**
     * True si le job de la dernière version est en cours (PENDING ou RUNNING) :
     * signal exposé au GET du profil pour afficher « Analyzing… » — l'état
     * vient de la base, il survit donc à la navigation de l'utilisateur.
     */
    public boolean hasInProgressLatestJob(UUID candidateId) {
        return isInProgress(latestJobStatus(candidateId));
    }

    /**
     * Analyse obsolète (D63) : la fiche de référence — dernière version AVEC
     * contenu — porte un {@code schema_version} différent de la version
     * candidat attendue. {@code false} sans aucune fiche (rien à rafraîchir) ;
     * une analyse en cours ne remplace pas la référence.
     */
    public boolean isAnalysisOutdated(UUID candidateId) {
        return normalizedProfileRepository
                .findLatestWithContentByCandidateId(candidateId, PageRequest.of(0, 1)).stream()
                .findFirst()
                .map(sheet -> !NormalizedProfileSchemaVersions.CANDIDATE.equals(sheet.getSchemaVersion()))
                .orElse(false);
    }

    /**
     * Validation explicite du profil, autorisée si {@code dirty || analysisOutdated
     * || failed} (D63) : no-op sinon (double-clic, re-POST). Une fiche
     * obsolète ne relance pas une analyse déjà en cours (PENDING/RUNNING) —
     * le double-clic reste un no-op. Le lock pessimiste de la ligne candidat
     * sérialise les validations concurrentes d'un même candidat — le
     * double-clic attend la commit puis tombe sur le no-op.
     */
    @Transactional
    public void validateProfile(UUID userId) {
        Candidate candidate = candidateRepository.findByIdForUpdate(userId)
                .orElseThrow(EmptyProfileException::new);
        boolean dirty = hasUnvalidatedChanges(candidate);
        NormalizationJobStatus latestStatus = latestJobStatus(userId);
        boolean failed = latestStatus == NormalizationJobStatus.FAILED;
        boolean outdated = !isInProgress(latestStatus) && isAnalysisOutdated(userId);
        if (!dirty && !outdated && !failed) {
            log.info("Candidate profile validation skipped : no change since last validation,"
                    + " userId={}, latestStatus={}", userId, latestStatus);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Integer maxVersion = normalizedProfileRepository.findMaxVersionByCandidateId(userId);
        int version = (maxVersion == null ? 0 : maxVersion) + 1;
        int superseded = normalizationJobRepository.supersedeForCandidate(userId,
                NormalizationJobStatus.PENDING, NormalizationJobStatus.SUPERSEDED);

        UUID profileId = UUID.randomUUID();
        normalizedProfileRepository.save(NormalizedProfile.builder()
                .id(profileId)
                .version(version)
                .schemaVersion(NormalizedProfileSchemaVersions.CANDIDATE)
                .validatedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build());
        normalizedProfileCandidateRepository.save(NormalizedProfileCandidate.builder()
                .normalizedProfileId(profileId)
                .candidateId(userId)
                .build());
        normalizationJobRepository.save(NormalizationJob.builder()
                .id(profileId)
                .status(NormalizationJobStatus.PENDING)
                .sourceType(NormalizationSourceType.CANDIDATE)
                .attempts(0)
                .nextAttemptAt(now)
                .createdAt(now)
                .build());

        log.info("Candidate profile validation registered : userId={}, version={}, dirty={}, outdated={},"
                + " failed={}, supersededPending={}, jobId={}",
                userId, version, dirty, outdated, failed, superseded, profileId);
        eventPublisher.publishEvent(new ProfileValidatedEvent(profileId));
    }

    private static boolean isInProgress(NormalizationJobStatus status) {
        return status == NormalizationJobStatus.PENDING || status == NormalizationJobStatus.RUNNING;
    }

    /**
     * Flux SSE du statut de normalisation du candidat (D64) : inscription
     * d'abord, puis relecture du statut du dernier job — {@code none} sans
     * aucune validation (rien à suivre, flux aussitôt fermé).
     */
    public SseEmitter subscribe(UUID userId) {
        log.info("Candidate normalization stream requested : userId={}", userId);
        return statusBroadcaster.subscribe(NormalizationStatusBroadcaster.Stream.candidate(userId),
                () -> latestJobStatus(userId));
    }

    /**
     * État du job de la dernière version du candidat, ou {@code null} si
     * aucune validation (jamais {@code SUPERSEDED} : seuls les PENDING
     * antérieurs le deviennent).
     */
    public NormalizationJobStatus latestJobStatus(UUID candidateId) {
        List<NormalizedProfile> latest = normalizedProfileRepository
                .findLatestByCandidateId(candidateId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            return null;
        }
        return normalizationJobRepository.findById(latest.get(0).getId())
                .map(NormalizationJob::getStatus)
                .orElse(null);
    }
}
