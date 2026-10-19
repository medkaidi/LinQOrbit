package com.linqorbit.matching.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
import com.linqorbit.candidate.entity.NormalizedProfileSchemaVersions;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.matching.dto.MatchingClarificationView;
import com.linqorbit.matching.dto.MatchingCriterionView;
import com.linqorbit.matching.dto.MatchingFeedbackItemRequest;
import com.linqorbit.matching.dto.MatchingFeedbackResponse;
import com.linqorbit.matching.dto.MatchingFeedbackView;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.MatchingSectionView;
import com.linqorbit.matching.dto.SaveMatchingFeedbackRequest;
import com.linqorbit.matching.entity.Clarification;
import com.linqorbit.matching.entity.ClarificationStatus;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingJob;
import com.linqorbit.matching.entity.MatchingJobStatus;
import com.linqorbit.matching.entity.MatchingCriterionFeedback;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.exception.InvalidMatchingException;
import com.linqorbit.matching.exception.MatchingNotFoundException;
import com.linqorbit.matching.repository.ClarificationRepository;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;

/**
 * Matching candidat ↔ offre (D50–D51, D58–D59) : lancement ou reprise de
 * l'analyse et lecture du résultat courant, côté candidat ; clarifications IA
 * (T-62, D52 : répondre, passer, terminer — chaque réponse ou skip relance une
 * réévaluation versionnée) et contestation par critère (T-63, D54 révisée par
 * D62 : remplacement complet, jamais de recalcul).
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

    static final String REQUIRED_FIRST = "Answer the recruiter's required questions before running the match.";
    static final String CLOSED = "The match is closed once your application is submitted.";
    static final String PROFILE_MISSING = "Validate your profile before running the match.";
    static final String PROFILE_OUTDATED = "Your profile analysis is outdated. Validate your profile again.";
    static final String OFFER_NOT_READY = "This offer cannot be evaluated yet.";
    static final String QUESTION_NOT_FOUND = "This question does not exist.";
    static final String QUESTION_CLOSED = "This question has already been closed.";
    static final String ANALYSIS_RUNNING = "Your match is being updated. Try again once the analysis is over.";
    static final String ASSESSMENT_OPEN = "Finish the assessment before reviewing your scores.";
    static final String NOTHING_TO_REVIEW = "There is no finished analysis to review yet.";
    static final String DUPLICATE_CRITERION = "Each criterion can be reviewed only once.";
    static final String UNKNOWN_CRITERION = "One of the reviewed criteria is not part of your match.";
    static final String COMMENT_TOO_LONG = "A comment must be at most 2000 characters.";
    /** Commentaire de contestation, une fois trimé (V23). */
    static final int COMMENT_MAX_LENGTH = 2000;

    private final ApplicationService applicationService;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final MatchingRepository matchingRepository;
    private final MatchingResultRepository matchingResultRepository;
    private final MatchingJobRepository matchingJobRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final MatchingStatusBroadcaster matchingStatusBroadcaster;
    private final CandidateRepository candidateRepository;
    private final ClarificationRepository clarificationRepository;
    private final MatchingCriterionFeedbackRepository feedbackRepository;

    /** Lance l'analyse (premier lancement ou relance après échec) ou reprend le matching existant. */
    @Transactional
    public MatchingResponse start(UUID userId, String jobPublicId) {
        log.info("Matching start requested : userId={}, jobPublicId={}", userId, jobPublicId);
        JobOffer offer = applicationService.requireOpenOffer(jobPublicId);
        requireOpenAccess(userId, offer.getId(), true);
        NormalizedProfile candidateSheet = currentCandidateSheet(userId)
                .orElseThrow(() -> refused(userId, offer, "candidate sheet missing", PROFILE_MISSING));
        if (!NormalizedProfileSchemaVersions.CANDIDATE.equals(candidateSheet.getSchemaVersion())) {
            throw refused(userId, offer, "candidate sheet schema " + candidateSheet.getSchemaVersion(),
                    PROFILE_OUTDATED);
        }
        NormalizedProfile offerSheet = currentOfferSheet(offer.getId())
                .filter(sheet -> NormalizedProfileSchemaVersions.OFFER.equals(sheet.getSchemaVersion()))
                .orElseThrow(() -> refused(userId, offer, "offer sheet missing or outdated", OFFER_NOT_READY));

        // TD-053 : verrou de la ligne candidat — deux premiers lancements simultanés ne créent qu'un matching.
        candidateRepository.findByIdForUpdate(userId);
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
            latest = createResult(locked, offerSheet.getId(), null);
            job = matchingJobRepository.findById(latest.getId()).orElseThrow();
        } else {
            log.info("Matching resumed : matchingId={}, version={}, status={}",
                    locked.getId(), latest.getVersion(), job.getStatus().getApiValue());
        }
        return toResponse(offer, locked, latest, job);
    }

    /** Matching courant du couple pour la fiche courante du candidat (404 sinon). */
    @Transactional(readOnly = true)
    public MatchingResponse getCurrent(UUID userId, String jobPublicId) {
        log.info("Matching read requested : userId={}, jobPublicId={}", userId, jobPublicId);
        Current current = current(userId, jobPublicId);
        return toResponse(current.offer(), current.matching(), current.result(), current.job());
    }

    /**
     * Abonnement SSE au statut de l'analyse courante (D60) : mêmes gardes que
     * la lecture (offre ouverte, accès fermé dès la transmission, 404 sans
     * matching), puis le statut courant est <b>relu en base après l'inscription</b>
     * au flux (requête scalaire, jamais l'entité du contexte de persistance) et
     * envoyé aussitôt — aucune transition perdue entre lecture et abonnement.
     */
    @Transactional(readOnly = true)
    public SseEmitter subscribe(UUID userId, String jobPublicId) {
        log.info("Matching status stream requested : userId={}, jobPublicId={}", userId, jobPublicId);
        Current current = current(userId, jobPublicId);
        UUID jobId = current.job().getId();
        return matchingStatusBroadcaster.subscribe(current.matching().getId(),
                () -> matchingJobRepository.findStatusById(jobId).orElse(current.job().getStatus()));
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
        return new Current(offer, matching, latest, job);
    }

    private record Current(JobOffer offer, Matching matching, MatchingResult result, MatchingJob job) {
    }

    // --- Clarifications (T-62, D52) -------------------------------------------

    /**
     * Réponse à la question ouverte : ANSWERED, puis réévaluation — nouvelle
     * version de résultat ({@code clarification_id} = cette question) et
     * nouveau job ; le worker rejoue tout l'historique et pose la question
     * suivante (ou clôt l'évaluation). Sous verrou de la ligne matching.
     */
    @Transactional
    public MatchingResponse answerClarification(UUID userId, String jobPublicId, UUID clarificationId,
            String answer) {
        log.info("Clarification answer requested : userId={}, jobPublicId={}, clarificationId={}", userId,
                jobPublicId, clarificationId);
        return closeAndReassess(userId, jobPublicId, clarificationId, answer.strip());
    }

    /**
     * Question passée : SKIPPED (elle consomme un cran du plafond), puis
     * réévaluation sans réponse — l'agent vise une autre lacune.
     */
    @Transactional
    public MatchingResponse skipClarification(UUID userId, String jobPublicId, UUID clarificationId) {
        log.info("Clarification skip requested : userId={}, jobPublicId={}, clarificationId={}", userId,
                jobPublicId, clarificationId);
        return closeAndReassess(userId, jobPublicId, clarificationId, null);
    }

    private MatchingResponse closeAndReassess(UUID userId, String jobPublicId, UUID clarificationId, String answer) {
        Current current = current(userId, jobPublicId);
        Matching locked = matchingRepository.findByIdForUpdate(current.matching().getId()).orElseThrow();
        Clarification clarification = clarificationRepository.findByIdAndMatchingId(clarificationId, locked.getId())
                .orElseThrow(() -> {
                    log.warn("Clarification rejected : unknown question, userId={}, clarificationId={}", userId,
                            clarificationId);
                    return new InvalidMatchingException(HttpStatus.NOT_FOUND, QUESTION_NOT_FOUND);
                });
        if (clarification.getStatus() != ClarificationStatus.OPEN) {
            log.warn("Clarification rejected : already {}, userId={}, clarificationId={}",
                    clarification.getStatus().getApiValue(), userId, clarificationId);
            throw new InvalidMatchingException(HttpStatus.CONFLICT, QUESTION_CLOSED);
        }
        requireNoAnalysisRunning(locked, userId);
        NormalizedProfile offerSheet = currentOfferSheet(current.offer().getId())
                .filter(sheet -> NormalizedProfileSchemaVersions.OFFER.equals(sheet.getSchemaVersion()))
                .orElseThrow(() -> refused(userId, current.offer(), "offer sheet missing or outdated",
                        OFFER_NOT_READY));

        boolean answered = answer != null;
        clarification.setStatus(answered ? ClarificationStatus.ANSWERED : ClarificationStatus.SKIPPED);
        clarification.setAnswer(answer);
        clarification.setAnsweredAt(answered ? LocalDateTime.now() : null);
        clarificationRepository.saveAndFlush(clarification);
        log.info("Clarification {} : matchingId={}, clarificationId={}",
                clarification.getStatus().getApiValue(), locked.getId(), clarificationId);

        MatchingResult result = createResult(locked, offerSheet.getId(), answered ? clarificationId : null);
        MatchingJob job = matchingJobRepository.findById(result.getId()).orElseThrow();
        return toResponse(current.offer(), locked, result, job);
    }

    /**
     * « Terminer l'évaluation » (D52) : la question ouverte passe SKIPPED et
     * {@code assessment_finished_at} est posé. Idempotent (déjà close : rien à
     * faire) ; refusé pendant une analyse (sa question suivante arriverait après
     * la fin) et sans résultat terminé exploitable (rien à contester ensuite) —
     * un résultat antérieur terminé suffit, même si la dernière analyse a échoué.
     */
    @Transactional
    public void finishAssessment(UUID userId, String jobPublicId) {
        log.info("Assessment finish requested : userId={}, jobPublicId={}", userId, jobPublicId);
        Current current = current(userId, jobPublicId);
        Matching locked = matchingRepository.findByIdForUpdate(current.matching().getId()).orElseThrow();
        if (locked.getAssessmentFinishedAt() != null) {
            log.info("Assessment already finished : matchingId={}", locked.getId());
            return;
        }
        requireNoAnalysisRunning(locked, userId);
        boolean reviewable = matchingResultRepository
                .findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(locked.getId())
                .map(result -> !criterionKeys(result).isEmpty())
                .orElse(false);
        if (!reviewable) {
            log.warn("Assessment finish rejected : no finished result, userId={}, matchingId={}", userId,
                    locked.getId());
            throw new InvalidMatchingException(HttpStatus.CONFLICT, NOTHING_TO_REVIEW);
        }
        int closed = clarificationRepository.closeOpen(locked.getId(), ClarificationStatus.OPEN,
                ClarificationStatus.SKIPPED);
        int finished = matchingRepository.finishAssessment(locked.getId(), LocalDateTime.now());
        log.info("Assessment finished : matchingId={}, openQuestionClosed={}, rows={}", locked.getId(), closed == 1,
                finished);
    }

    // --- Contestation (T-63, D54 révisée par D62) -----------------------------

    /**
     * Remplacement complet des contestations du candidat sur le dernier
     * résultat terminé : items absents supprimés, {@code created_at} conservé
     * sur une mise à jour. Préconditions (409) : évaluation close, aucune
     * question ouverte, aucune analyse en cours, aucune candidature transmise.
     * <b>Aucun recalcul</b> : le résultat, ses scores et ses sections ne sont
     * jamais touchés.
     */
    @Transactional
    public MatchingFeedbackResponse saveFeedback(UUID userId, String jobPublicId,
            SaveMatchingFeedbackRequest request) {
        log.info("Matching feedback save requested : userId={}, jobPublicId={}, items={}", userId, jobPublicId,
                request.items().size());
        Current current = current(userId, jobPublicId);
        Matching locked = matchingRepository.findByIdForUpdate(current.matching().getId()).orElseThrow();
        if (locked.getAssessmentFinishedAt() == null
                || clarificationRepository.findByMatchingIdAndStatus(locked.getId(), ClarificationStatus.OPEN)
                        .isPresent()) {
            log.warn("Matching feedback rejected : assessment still open, userId={}, matchingId={}", userId,
                    locked.getId());
            throw new InvalidMatchingException(HttpStatus.CONFLICT, ASSESSMENT_OPEN);
        }
        requireNoAnalysisRunning(locked, userId);
        MatchingResult target = matchingResultRepository
                .findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(locked.getId())
                .orElseThrow(() -> {
                    log.warn("Matching feedback rejected : no finished result, userId={}, matchingId={}", userId,
                            locked.getId());
                    return new InvalidMatchingException(HttpStatus.CONFLICT, NOTHING_TO_REVIEW);
                });

        Set<String> criterionKeys = criterionKeys(target);
        Map<String, FeedbackInput> inputs = new HashMap<>();
        for (MatchingFeedbackItemRequest item : request.items()) {
            if (!criterionKeys.contains(item.criterionKey())) {
                log.warn("Matching feedback rejected : unknown criterion, userId={}, matchingId={}", userId,
                        locked.getId());
                throw new InvalidMatchingException(HttpStatus.BAD_REQUEST, UNKNOWN_CRITERION);
            }
            String comment = item.comment() == null ? null : item.comment().strip();
            if (comment != null && comment.length() > COMMENT_MAX_LENGTH) {
                throw new InvalidMatchingException(HttpStatus.BAD_REQUEST, COMMENT_TOO_LONG);
            }
            FeedbackInput input = new FeedbackInput(item.selfValue(),
                    comment == null || comment.isEmpty() ? null : comment);
            if (inputs.put(item.criterionKey(), input) != null) {
                log.warn("Matching feedback rejected : duplicate criterion, userId={}, matchingId={}", userId,
                        locked.getId());
                throw new InvalidMatchingException(HttpStatus.BAD_REQUEST, DUPLICATE_CRITERION);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        List<MatchingCriterionFeedback> existing = feedbackRepository
                .findByMatchingResultIdOrderByCriterionKeyAsc(target.getId());
        List<MatchingCriterionFeedback> removed = existing.stream()
                .filter(feedback -> !inputs.containsKey(feedback.getCriterionKey()))
                .toList();
        feedbackRepository.deleteAll(removed);
        Map<String, MatchingCriterionFeedback> kept = new HashMap<>();
        existing.forEach(feedback -> kept.put(feedback.getCriterionKey(), feedback));
        List<MatchingCriterionFeedback> saved = new ArrayList<>();
        inputs.forEach((key, input) -> {
            MatchingCriterionFeedback feedback = kept.get(key);
            if (feedback == null) {
                feedback = MatchingCriterionFeedback.builder()
                        .id(UUID.randomUUID())
                        .matchingId(locked.getId())
                        .matchingResultId(target.getId())
                        .criterionKey(key)
                        .build();
            }
            feedback.setSelfValue(input.selfValue());
            feedback.setComment(input.comment());
            feedback.setUpdatedAt(now);
            saved.add(feedback);
        });
        feedbackRepository.saveAllAndFlush(saved);
        log.info("Matching feedback saved : matchingId={}, resultId={}, items={}, removed={}", locked.getId(),
                target.getId(), saved.size(), removed.size());
        return new MatchingFeedbackResponse(feedbackViews(target.getId()));
    }

    private record FeedbackInput(int selfValue, String comment) {
    }

    /** Clés des critères d'un résultat terminé (cibles possibles d'une contestation). */
    private Set<String> criterionKeys(MatchingResult result) {
        Set<String> keys = new HashSet<>();
        for (JsonNode section : objectMapper.readTree(result.getResult()).path("sections")) {
            for (JsonNode criterion : section.path("criteria")) {
                keys.add(criterion.path("key").asString(""));
            }
        }
        return keys;
    }

    private List<MatchingFeedbackView> feedbackViews(UUID resultId) {
        return feedbackRepository.findByMatchingResultIdOrderByCriterionKeyAsc(resultId).stream()
                .map(feedback -> new MatchingFeedbackView(feedback.getCriterionKey(), feedback.getSelfValue(),
                        feedback.getComment()))
                .toList();
    }

    /** Une analyse en vol (dernier job PENDING/RUNNING) bloque réponses, skips, fin et contestation. */
    private void requireNoAnalysisRunning(Matching matching, UUID userId) {
        boolean running = matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(matching.getId())
                .flatMap(latest -> matchingJobRepository.findById(latest.getId()))
                .map(job -> job.getStatus() == MatchingJobStatus.PENDING
                        || job.getStatus() == MatchingJobStatus.RUNNING)
                .orElse(false);
        if (running) {
            log.warn("Matching operation rejected : analysis running, userId={}, matchingId={}", userId,
                    matching.getId());
            throw new InvalidMatchingException(HttpStatus.CONFLICT, ANALYSIS_RUNNING);
        }
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

    private MatchingResult createResult(Matching matching, UUID offerSheetId, UUID clarificationId) {
        Integer maxVersion = matchingResultRepository.findMaxVersionByMatchingId(matching.getId());
        int version = (maxVersion == null ? 0 : maxVersion) + 1;
        LocalDateTime now = LocalDateTime.now();
        MatchingResult result = matchingResultRepository.saveAndFlush(MatchingResult.builder()
                .id(UUID.randomUUID())
                .matchingId(matching.getId())
                .version(version)
                .schemaVersion(MatchingScoring.RESULT_SCHEMA_VERSION)
                .jobOfferNormalizedProfileId(offerSheetId)
                .clarificationId(clarificationId)
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
     * Vue candidat : statut de la dernière analyse et le score de chaque
     * critère du <b>dernier résultat terminé</b> (les scores précédents
     * restent visibles pendant une réévaluation) — jamais poids, provenance,
     * score de section ni justification. Plus la question ouverte (avec son
     * rationale destiné au candidat et le budget restant après elle), la fin
     * d'évaluation et les contestations du candidat.
     */
    private MatchingResponse toResponse(JobOffer offer, Matching matching, MatchingResult latest, MatchingJob job) {
        Optional<MatchingResult> finished = latest.getResult() != null
                ? Optional.of(latest)
                : matchingResultRepository.findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(matching.getId());
        List<MatchingSectionView> sections = new ArrayList<>();
        finished.ifPresent(result -> {
            JsonNode stored = objectMapper.readTree(result.getResult());
            for (JsonNode section : stored.path("sections")) {
                List<MatchingCriterionView> criteria = new ArrayList<>();
                for (JsonNode criterion : section.path("criteria")) {
                    criteria.add(new MatchingCriterionView(criterion.path("key").asString(""),
                            criterion.path("label").asString(""), criterion.path("score").asInt()));
                }
                sections.add(new MatchingSectionView(section.path("section").asString(""), criteria));
            }
        });
        MatchingClarificationView clarification = clarificationRepository
                .findByMatchingIdAndStatus(matching.getId(), ClarificationStatus.OPEN)
                .map(open -> new MatchingClarificationView(open.getId(), open.getQuestion(), open.getRationale(),
                        Math.max(offer.getMaxClarificationQuestions()
                                - (int) clarificationRepository.countByMatchingId(matching.getId()), 0)))
                .orElse(null);
        List<MatchingFeedbackView> feedback = finished.map(result -> feedbackViews(result.getId())).orElse(List.of());
        return new MatchingResponse(matching.getId(), job.getStatus().getApiValue(), sections,
                matching.getAssessmentFinishedAt() != null, clarification, feedback);
    }
}
