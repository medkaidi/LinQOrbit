package com.linqorbit.matching.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.service.ApplicationService;
import com.linqorbit.application.service.ApplicationService.CoupleApplication;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.matching.dto.MatchingCriterionView;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.MatchingSectionView;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingJob;
import com.linqorbit.matching.entity.MatchingJobStatus;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.exception.InvalidMatchingException;
import com.linqorbit.matching.exception.MatchingNotFoundException;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;

/**
 * Matching candidat ↔ offre (D50–D51, D58–D59) : lancement ou reprise de
 * l'analyse et lecture du résultat courant, côté candidat.
 *
 * <p>Préconditions : offre publiée non expirée (même 404 sûr que la lecture
 * publique), brouillon de candidature avec toutes les questions obligatoires
 * répondues, aucune candidature transmise (accès fermé dès SUBMITTED, y
 * compris en consultation), fiches normalisées avec contenu au schéma courant
 * des deux côtés. Identité = couple + version de fiche candidat : fiche
 * inchangée → reprise, fiche régénérée → nouveau matching de zéro. Un nouveau
 * résultat ({@code version = max + 1}, sous verrou pessimiste de la ligne
 * matching) n'est créé qu'au premier lancement ou après un échec — jamais
 * pendant une analyse en vol ni sur un résultat terminé.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingService {

    /** Schéma courant de la fiche candidat (D36) — une fiche plus ancienne se revalide. */
    static final String CANDIDATE_SCHEMA_VERSION = "3";
    /** Schéma courant de la fiche offre (D35). */
    static final String OFFER_SCHEMA_VERSION = "2";

    static final String REQUIRED_FIRST = "Answer the recruiter's required questions before running the match.";
    static final String CLOSED = "The match is closed once your application is submitted.";
    static final String PROFILE_MISSING = "Validate your profile before running the match.";
    static final String PROFILE_OUTDATED = "Your profile analysis is outdated. Validate your profile again.";
    static final String OFFER_NOT_READY = "This offer cannot be evaluated yet.";

    private final ApplicationService applicationService;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final MatchingRepository matchingRepository;
    private final MatchingResultRepository matchingResultRepository;
    private final MatchingJobRepository matchingJobRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final MatchingStatusBroadcaster matchingStatusBroadcaster;

    /** Lance l'analyse (premier lancement ou relance après échec) ou reprend le matching existant. */
    @Transactional
    public MatchingResponse start(UUID userId, String jobPublicId) {
        log.info("Matching start requested : userId={}, jobPublicId={}", userId, jobPublicId);
        JobOffer offer = applicationService.requireOpenOffer(jobPublicId);
        requireOpenAccess(userId, offer.getId(), true);
        NormalizedProfile candidateSheet = currentCandidateSheet(userId)
                .orElseThrow(() -> refused(userId, offer, "candidate sheet missing", PROFILE_MISSING));
        if (!CANDIDATE_SCHEMA_VERSION.equals(candidateSheet.getSchemaVersion())) {
            throw refused(userId, offer, "candidate sheet schema " + candidateSheet.getSchemaVersion(),
                    PROFILE_OUTDATED);
        }
        NormalizedProfile offerSheet = currentOfferSheet(offer.getId())
                .filter(sheet -> OFFER_SCHEMA_VERSION.equals(sheet.getSchemaVersion()))
                .orElseThrow(() -> refused(userId, offer, "offer sheet missing or outdated", OFFER_NOT_READY));

        Matching matching = matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(
                        userId, offer.getId(), candidateSheet.getId())
                .orElseGet(() -> {
                    Matching created = matchingRepository.saveAndFlush(Matching.builder()
                            .id(UUID.randomUUID())
                            .candidateId(userId)
                            .jobOfferId(offer.getId())
                            .candidateNormalizedProfileId(candidateSheet.getId())
                            .build());
                    log.info("Matching created : userId={}, offerId={}, matchingId={}, candidateSheetId={}",
                            userId, offer.getId(), created.getId(), candidateSheet.getId());
                    return created;
                });
        // Verrou pessimiste : deux lancements concurrents ne créent jamais deux versions.
        Matching locked = matchingRepository.findByIdForUpdate(matching.getId()).orElseThrow();
        MatchingResult latest = matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(locked.getId())
                .orElse(null);
        MatchingJob job = latest == null ? null : matchingJobRepository.findById(latest.getId()).orElse(null);
        if (latest == null || job == null || job.getStatus() == MatchingJobStatus.FAILED) {
            latest = createResult(locked, offerSheet.getId());
            job = matchingJobRepository.findById(latest.getId()).orElseThrow();
        } else {
            log.info("Matching resumed : matchingId={}, version={}, status={}",
                    locked.getId(), latest.getVersion(), job.getStatus().getApiValue());
        }
        return toResponse(locked, latest, job);
    }

    /** Matching courant du couple pour la fiche courante du candidat (404 sinon). */
    @Transactional(readOnly = true)
    public MatchingResponse getCurrent(UUID userId, String jobPublicId) {
        log.info("Matching read requested : userId={}, jobPublicId={}", userId, jobPublicId);
        Current current = current(userId, jobPublicId);
        return toResponse(current.matching(), current.result(), current.job());
    }

    /**
     * Abonnement SSE au statut de l'analyse courante (D60) : mêmes gardes que
     * la lecture (offre ouverte, accès fermé dès la transmission, 404 sans
     * matching), puis le statut courant est envoyé aussitôt.
     */
    @Transactional(readOnly = true)
    public SseEmitter subscribe(UUID userId, String jobPublicId) {
        log.info("Matching status stream requested : userId={}, jobPublicId={}", userId, jobPublicId);
        Current current = current(userId, jobPublicId);
        return matchingStatusBroadcaster.subscribe(current.matching().getId(), current.job().getStatus());
    }

    /** Matching, dernier résultat et son job pour la fiche courante du candidat. */
    private Current current(UUID userId, String jobPublicId) {
        JobOffer offer = applicationService.requireOpenOffer(jobPublicId);
        requireOpenAccess(userId, offer.getId(), false);
        Matching matching = currentCandidateSheet(userId)
                .flatMap(sheet -> matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(
                        userId, offer.getId(), sheet.getId()))
                .orElseThrow(() -> {
                    log.warn("Matching read rejected : none for current sheet, userId={}, offerId={}",
                            userId, offer.getId());
                    return new MatchingNotFoundException(
                            "no matching for candidate " + userId + " and offer " + offer.getId());
                });
        MatchingResult latest = matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(matching.getId())
                .orElseThrow(() -> new MatchingNotFoundException("matching " + matching.getId() + " has no result"));
        MatchingJob job = matchingJobRepository.findById(latest.getId())
                .orElseThrow(() -> new MatchingNotFoundException("result " + latest.getId() + " has no job"));
        return new Current(matching, latest, job);
    }

    private record Current(Matching matching, MatchingResult result, MatchingJob job) {
    }

    /**
     * Accès au matching (D59) : fermé dès qu'une candidature est transmise ;
     * le lancement exige en plus un brouillon dont les obligatoires sont
     * répondues (la consultation d'un matching existant ne l'exige pas).
     */
    private void requireOpenAccess(UUID userId, UUID offerId, boolean starting) {
        Optional<CoupleApplication> application = applicationService.findCoupleApplication(userId, offerId);
        if (application.isPresent() && application.get().status() != ApplicationStatus.DRAFT) {
            log.warn("Matching rejected : application already submitted, userId={}, offerId={}", userId, offerId);
            throw new InvalidMatchingException(HttpStatus.CONFLICT, CLOSED);
        }
        if (starting && (application.isEmpty() || !application.get().requiredAnswered())) {
            log.warn("Matching start rejected : required questions unanswered, userId={}, offerId={}",
                    userId, offerId);
            throw new InvalidMatchingException(HttpStatus.CONFLICT, REQUIRED_FIRST);
        }
    }

    private MatchingResult createResult(Matching matching, UUID offerSheetId) {
        Integer maxVersion = matchingResultRepository.findMaxVersionByMatchingId(matching.getId());
        int version = (maxVersion == null ? 0 : maxVersion) + 1;
        LocalDateTime now = LocalDateTime.now();
        MatchingResult result = matchingResultRepository.saveAndFlush(MatchingResult.builder()
                .id(UUID.randomUUID())
                .matchingId(matching.getId())
                .version(version)
                .schemaVersion(MatchingScoring.RESULT_SCHEMA_VERSION)
                .jobOfferNormalizedProfileId(offerSheetId)
                .build());
        matchingJobRepository.saveAndFlush(MatchingJob.builder()
                .id(result.getId())
                .status(MatchingJobStatus.PENDING)
                .attempts(0)
                .nextAttemptAt(now)
                .build());
        log.info("Matching analysis registered : matchingId={}, version={}, jobId={}",
                matching.getId(), version, result.getId());
        eventPublisher.publishEvent(new MatchingRequestedEvent(result.getId()));
        return result;
    }

    private Optional<NormalizedProfile> currentCandidateSheet(UUID userId) {
        return normalizedProfileRepository.findLatestWithContentByCandidateId(userId, PageRequest.of(0, 1))
                .stream().findFirst();
    }

    private Optional<NormalizedProfile> currentOfferSheet(UUID offerId) {
        return normalizedProfileJobOfferRepository.findLatestWithContentByOfferId(offerId, PageRequest.of(0, 1))
                .stream().findFirst();
    }

    private InvalidMatchingException refused(UUID userId, JobOffer offer, String reason, String message) {
        log.warn("Matching start rejected : {}, userId={}, offerId={}", reason, userId, offer.getId());
        return new InvalidMatchingException(HttpStatus.CONFLICT, message);
    }

    /**
     * Vue candidat : statut et, une fois terminé, le score de chaque critère
     * par section — jamais poids, provenance, score de section ni justification.
     */
    private MatchingResponse toResponse(Matching matching, MatchingResult result, MatchingJob job) {
        List<MatchingSectionView> sections = new ArrayList<>();
        if (job.getStatus() == MatchingJobStatus.DONE && result.getResult() != null) {
            JsonNode stored = objectMapper.readTree(result.getResult());
            for (JsonNode section : stored.path("sections")) {
                List<MatchingCriterionView> criteria = new ArrayList<>();
                for (JsonNode criterion : section.path("criteria")) {
                    criteria.add(new MatchingCriterionView(criterion.path("key").asString(""),
                            criterion.path("label").asString(""), criterion.path("score").asInt()));
                }
                sections.add(new MatchingSectionView(section.path("section").asString(""), criteria));
            }
        }
        return new MatchingResponse(matching.getId(), job.getStatus().getApiValue(), sections);
    }
}
