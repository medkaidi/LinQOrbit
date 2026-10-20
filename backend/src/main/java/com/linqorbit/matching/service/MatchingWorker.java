package com.linqorbit.matching.service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.common.logging.RequestLoggingFilter;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.matching.client.MatchingAnalyzeClient;
import com.linqorbit.matching.client.MatchingClarifyClient;
import com.linqorbit.matching.dto.ClarificationHistoryPayload;
import com.linqorbit.matching.dto.MatchingAnalyzeRequest;
import com.linqorbit.matching.dto.MatchingClarifyRequest;
import com.linqorbit.matching.dto.MatchingCriterionPayload;
import com.linqorbit.matching.dto.MatchingEducationPayload;
import com.linqorbit.matching.entity.Clarification;
import com.linqorbit.matching.entity.ClarificationStatus;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingJob;
import com.linqorbit.matching.entity.MatchingJobStatus;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.exception.InvalidMatchingAnalysisException;
import com.linqorbit.matching.repository.ClarificationRepository;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Exécution asynchrone des analyses de matching, <b>miroir exact</b> de
 * {@code NormalizationWorker} (D51) : déclenchée uniquement par un lancement
 * explicite — aucun polling. L'événement est consommé après commit, le job est
 * soumis à un pool dédié ; les retries sont des one-shot sur un scheduler
 * dédié ; la récupération au démarrage reprend les orphelins de crash.
 *
 * <p>Toutes les transitions passent par un CAS {@code WHERE status = :expected}
 * : exécution initiale + 2 retries = 3 exécutions au plus, {@code FAILED}
 * terminal pour un job (le candidat relance, ce qui crée une nouvelle version
 * de résultat).</p>
 *
 * <p>Contexte rejoué (D58) : à chaque exécution, le worker envoie au service
 * IA les deux fiches telles que stockées et les critères extraits de la fiche
 * offre — le service IA ne garde rien. L'analyse est contrôlée puis notée par
 * {@link MatchingScoring} ; une analyse inexploitable (clé manquante ou en
 * trop, score hors bornes) est un échec d'exécution comme un autre.</p>
 *
 * <p>Clarifications (T-62, D52) : chaque exécution rejoue aussi les
 * évaluations du résultat terminé précédent (sans poids) et toutes les
 * clarifications fermées dans l'ordre d'ajout, puis — tant que le plafond de
 * l'offre n'est pas atteint et l'évaluation pas close — demande la question
 * suivante à {@code /matching/clarify}. Une seule transaction écrit ensuite le
 * résultat, le DONE et, soit la nouvelle question OPEN, soit la fin
 * d'évaluation ({@code assessment_finished_at}). Un échec rejoue tout :
 * l'historique est déjà en base.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingWorker {

    /** Exécutions totales autorisées par job : initiale + 2 retries. */
    static final int MAX_ATTEMPTS = 3;
    /** Un RUNNING plus vieux que ce seuil est considéré orphelin (worker mort). */
    static final int STALE_RUNNING_MINUTES = 10;
    /** Taille max de la colonne matching_job.error. */
    private static final int ERROR_MAX_LENGTH = 500;
    /** Colonnes clarification.question / rationale (V22). */
    private static final int QUESTION_MAX_LENGTH = 500;
    private static final int RATIONALE_MAX_LENGTH = 700;

    @Qualifier("matchingExecutor")
    private final ThreadPoolTaskExecutor matchingExecutor;
    @Qualifier("matchingTaskScheduler")
    private final TaskScheduler matchingTaskScheduler;
    private final TransactionTemplate transactionTemplate;
    private final MatchingJobRepository matchingJobRepository;
    private final MatchingResultRepository matchingResultRepository;
    private final MatchingRepository matchingRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final MatchingCriteriaBuilder matchingCriteriaBuilder;
    private final MatchingScoring matchingScoring;
    private final MatchingAnalyzeClient matchingAnalyzeClient;
    private final MatchingClarifyClient matchingClarifyClient;
    private final ClarificationRepository clarificationRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ObjectMapper objectMapper;
    private final MatchingStatusBroadcaster matchingStatusBroadcaster;
    @Value("${app.matching.retry-delay-seconds}")
    private final int retryDelaySeconds;

    /** Après commit d'un lancement : soumission immédiate au pool dédié. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onMatchingRequested(MatchingRequestedEvent event) {
        dispatch(event.jobId());
    }

    /**
     * Récupération au démarrage (seul « filet » du système) : RUNNING périmés
     * → replanifiés ; PENDING dûs → exécutés ; PENDING futurs → planifiés.
     */
    @EventListener(ApplicationReadyEvent.class)
    void recoverOrphanJobs() {
        try {
            Set<UUID> handled = new HashSet<>();
            recoverStaleRunningJobs(handled);
            redispatchPendingJobs(handled);
        } catch (Exception ex) {
            log.error("Matching boot recovery failed", ex);
        }
    }

    private void recoverStaleRunningJobs(Set<UUID> handled) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(STALE_RUNNING_MINUTES);
        List<MatchingJob> stale = matchingJobRepository
                .findByStatusAndStartedAtLessThanEqual(MatchingJobStatus.RUNNING, threshold);
        for (MatchingJob job : stale) {
            log.warn("Recovering stale RUNNING matching job : jobId={}, startedAt={}", job.getId(), job.getStartedAt());
            retryOrFail(job, "Worker presumed dead before completion");
            handled.add(job.getId());
        }
    }

    private void redispatchPendingJobs(Set<UUID> handled) {
        LocalDateTime now = LocalDateTime.now();
        for (MatchingJob job : matchingJobRepository.findByStatus(MatchingJobStatus.PENDING)) {
            if (handled.contains(job.getId())) {
                continue;
            }
            if (job.getNextAttemptAt().isAfter(now)) {
                log.info("Rescheduling pending matching job : jobId={}, nextAttemptAt={}",
                        job.getId(), job.getNextAttemptAt());
                scheduleAt(job.getId(), job.getNextAttemptAt());
            } else {
                dispatch(job.getId());
            }
        }
    }

    /** Soumet au pool ; rejet (queue saturée) → re-soumission planifiée, le job reste PENDING. */
    private void dispatch(UUID jobId) {
        try {
            matchingExecutor.execute(() -> executeJob(jobId));
        } catch (RuntimeException ex) {
            log.error("Matching job submission failed, scheduling a re-submission : jobId={}", jobId, ex);
            try {
                scheduleAt(jobId, LocalDateTime.now().plusSeconds(retryDelaySeconds));
            } catch (RuntimeException scheduleEx) {
                log.error("Matching job re-submission scheduling failed : jobId={} — job stays PENDING, "
                        + "boot recovery will pick it up", jobId, scheduleEx);
            }
        }
    }

    /** One-shot à l'échéance : le scheduler ne fait que soumettre au pool dédié. */
    private void scheduleAt(UUID jobId, LocalDateTime at) {
        try {
            matchingTaskScheduler.schedule(() -> dispatch(jobId), instantOf(at));
        } catch (RuntimeException ex) {
            log.error("Matching scheduling failed : jobId={} — job stays PENDING, boot recovery will pick it up",
                    jobId, ex);
        }
    }

    /** Claim CAS puis exécution : appel IA hors tx, fin de vie en txs courtes. */
    void executeJob(UUID jobId) {
        try {
            MatchingJob job = claim(jobId);
            if (job == null) {
                return;
            }
            MDC.put(RequestLoggingFilter.CORRELATION_ID, jobId.toString());
            publishStatus(job.getId(), MatchingJobStatus.RUNNING);
            try {
                execute(job);
            } catch (AiServiceException ex) {
                log.warn("Matching analysis failed : jobId={}, status={}, detail={}",
                        job.getId(), ex.getStatus(), ex.getMessage());
                retryOrFail(job, ex.getMessage());
            } catch (InvalidMatchingAnalysisException ex) {
                log.warn("Matching analysis unusable : jobId={}, detail={}", job.getId(), ex.getMessage());
                retryOrFail(job, ex.getMessage());
            } catch (Exception ex) {
                log.error("Matching unexpected error : jobId={}", job.getId(), ex);
                retryOrFail(job, "Unexpected error during matching");
            } finally {
                MDC.remove(RequestLoggingFilter.CORRELATION_ID);
            }
        } catch (Exception ex) {
            log.error("Matching job execution failed unexpectedly : jobId={}", jobId, ex);
        }
    }

    /** Tx courte : CAS PENDING→RUNNING, un seul vainqueur ; null si inéxécutable. */
    private MatchingJob claim(UUID jobId) {
        return transactionTemplate.execute(status -> {
            int claimed = matchingJobRepository.casStatus(jobId, MatchingJobStatus.PENDING, MatchingJobStatus.RUNNING,
                    LocalDateTime.now());
            if (claimed != 1) {
                log.debug("Matching job not claimable (done or failed) : jobId={}", jobId);
                return null;
            }
            return matchingJobRepository.findById(jobId).orElse(null);
        });
    }

    /**
     * Contexte complet → analyse IA (hors tx) → contrôle + barème → question
     * suivante (hors tx) → résultat + DONE + question OPEN ou fin d'évaluation
     * en une tx.
     */
    private void execute(MatchingJob job) {
        MatchingResult result = matchingResultRepository.findById(job.getId())
                .orElseThrow(() -> new IllegalStateException("Job without matching result"));
        Matching matching = matchingRepository.findById(result.getMatchingId())
                .orElseThrow(() -> new IllegalStateException("Result without matching"));
        JsonNode candidate = sheetContent(matching.getCandidateNormalizedProfileId());
        JsonNode offer = sheetContent(result.getJobOfferNormalizedProfileId());
        List<MatchingCriterion> criteria = matchingCriteriaBuilder.build(offer);
        if (criteria.isEmpty()) {
            throw new InvalidMatchingAnalysisException("The offer sheet has no criterion to score");
        }
        List<MatchingCriterionPayload> payload = criteria.stream()
                .map(criterion -> new MatchingCriterionPayload(criterion.key(), criterion.section().getApiValue(),
                        criterion.label(), criterion.requirement(), educationPayload(criterion.education())))
                .toList();
        List<ClarificationHistoryPayload> history = closedClarifications(matching.getId());
        String analysis = matchingAnalyzeClient.analyze(new MatchingAnalyzeRequest(matching.getId().toString(),
                candidate, offer, payload, previousAssessments(matching.getId(), result.getVersion()), history));
        JsonNode parsedAnalysis = parse(analysis);
        ObjectNode scored = matchingScoring.score(criteria, parsedAnalysis);
        String json = objectMapper.writeValueAsString(scored);
        NextQuestion next = nextQuestion(matching, candidate, offer, payload, parsedAnalysis, history);
        LocalDateTime now = LocalDateTime.now();
        Integer done = transactionTemplate.execute(txStatus -> {
            matchingResultRepository.setResult(result.getId(), json);
            int applied = matchingJobRepository.casDone(job.getId(), MatchingJobStatus.RUNNING,
                    MatchingJobStatus.DONE, now);
            if (applied == 1) {
                if (next.question() != null) {
                    clarificationRepository.saveAndFlush(Clarification.builder()
                            .id(UUID.randomUUID())
                            .matchingId(matching.getId())
                            .matchingResultId(result.getId())
                            .question(next.question())
                            .rationale(next.rationale())
                            .status(ClarificationStatus.OPEN)
                            .build());
                } else if (next.finish()) {
                    matchingRepository.finishAssessment(matching.getId(), now);
                }
            }
            return applied;
        });
        publishIfApplied(done, job.getId(), MatchingJobStatus.DONE);
        log.info("Matching analysis done : jobId={}, matchingId={}, version={}, criteria={}, question={}, finished={}",
                job.getId(), matching.getId(), result.getVersion(), criteria.size(), next.question() != null,
                next.finish());
    }

    /** Exigence de formation structurée (D68) ; {@code null} pour tout autre critère. */
    private static MatchingEducationPayload educationPayload(MatchingEducation education) {
        return education == null ? null
                : new MatchingEducationPayload(education.degreeLevels(), education.credentials(), education.fields());
    }

    /**
     * Suite de la boucle (D52) : question OPEN suivante, fin d'évaluation, ou
     * rien (évaluation déjà close). Le budget restant = plafond de l'offre −
     * questions déjà posées (skips compris) ; budget épuisé ou agent à sec →
     * fin, sans appel IA dans le premier cas. La formation (critère
     * déterministe, D68) ne se clarifie jamais : son critère et son évaluation
     * sont retirés de la requête ; sans autre critère, l'évaluation se clôt
     * sans appel IA.
     */
    private NextQuestion nextQuestion(Matching matching, JsonNode candidate, JsonNode offer,
            List<MatchingCriterionPayload> payload, JsonNode analysis, List<ClarificationHistoryPayload> history) {
        if (matching.getAssessmentFinishedAt() != null) {
            return NextQuestion.NONE;
        }
        List<MatchingCriterionPayload> criteria = payload.stream()
                .filter(criterion -> criterion.education() == null)
                .toList();
        if (criteria.isEmpty()) {
            log.info("Matching assessment finished : nothing to clarify, matchingId={}", matching.getId());
            return NextQuestion.FINISH;
        }
        Set<String> clarifiableKeys = criteria.stream()
                .map(MatchingCriterionPayload::key)
                .collect(Collectors.toSet());
        int cap = jobOfferRepository.findById(matching.getJobOfferId())
                .map(JobOffer::getMaxClarificationQuestions)
                .orElse(0);
        int remaining = cap - (int) clarificationRepository.countByMatchingId(matching.getId());
        if (remaining <= 0) {
            log.info("Matching assessment finished : budget used, matchingId={}, cap={}", matching.getId(), cap);
            return NextQuestion.FINISH;
        }
        List<JsonNode> assessments = new ArrayList<>();
        analysis.path("assessments").forEach(assessment -> {
            if (clarifiableKeys.contains(assessment.path("criterionKey").asString(""))) {
                assessments.add(assessment);
            }
        });
        JsonNode suggestion = parse(matchingClarifyClient.clarify(new MatchingClarifyRequest(
                matching.getId().toString(), candidate, offer, criteria, assessments, history, remaining)));
        JsonNode question = suggestion.path("question");
        if (question.isMissingNode() || question.isNull()) {
            log.info("Matching assessment finished : no question left, matchingId={}", matching.getId());
            return NextQuestion.FINISH;
        }
        String text = question.path("question").asString("").strip();
        String rationale = question.path("rationale").asString("").strip();
        if (text.isEmpty() || text.length() > QUESTION_MAX_LENGTH || rationale.length() > RATIONALE_MAX_LENGTH) {
            throw new InvalidMatchingAnalysisException("Unusable clarification question");
        }
        return new NextQuestion(text, rationale.isEmpty() ? null : rationale, false);
    }

    /** Question suivante à ouvrir, ou fin d'évaluation à poser (les deux absents : rien à faire). */
    private record NextQuestion(String question, String rationale, boolean finish) {
        static final NextQuestion NONE = new NextQuestion(null, null, false);
        static final NextQuestion FINISH = new NextQuestion(null, null, true);
    }

    /**
     * Clarifications fermées, plus ancienne d'abord : l'ordre est stable d'un
     * tour à l'autre (append-only), donc les index de preuve
     * {@code clarification} des résultats précédents restent valables.
     */
    private List<ClarificationHistoryPayload> closedClarifications(UUID matchingId) {
        return clarificationRepository.findByMatchingIdAndStatusInOrderByCreatedAtAscIdAsc(matchingId,
                        List.of(ClarificationStatus.ANSWERED, ClarificationStatus.SKIPPED))
                .stream()
                .map(clarification -> new ClarificationHistoryPayload(clarification.getQuestion(),
                        clarification.getRationale(), clarification.getAnswer(),
                        clarification.getStatus().getApiValue()))
                .toList();
    }

    /**
     * Évaluations du dernier résultat terminé avant cette version : clé, score,
     * justification et preuves — jamais le poids. Un item incohérent avec la
     * règle de preuve (score 0 ⇔ aucune preuve, D61) — un résultat produit
     * avant cette règle — n'est pas rejoué : le service IA le refuserait.
     */
    private List<JsonNode> previousAssessments(UUID matchingId, Integer version) {
        return matchingResultRepository
                .findFirstByMatchingIdAndResultIsNotNullAndVersionLessThanOrderByVersionDesc(matchingId, version)
                .map(previous -> {
                    List<JsonNode> assessments = new ArrayList<>();
                    for (JsonNode section : parse(previous.getResult()).path("sections")) {
                        for (JsonNode item : section.path("criteria")) {
                            JsonNode evidence = item.path("evidence");
                            int score = item.path("score").asInt();
                            boolean hasEvidence = evidence.isArray() && !evidence.isEmpty();
                            if ((score == 0) == hasEvidence) {
                                continue;
                            }
                            ObjectNode assessment = objectMapper.createObjectNode();
                            assessment.put("criterionKey", item.path("key").asString(""));
                            assessment.put("score", score);
                            assessment.put("rationale", item.path("rationale").asString(""));
                            assessment.set("evidence", hasEvidence ? evidence : objectMapper.createArrayNode());
                            assessments.add(assessment);
                        }
                    }
                    return assessments;
                })
                .orElse(List.of());
    }

    private JsonNode sheetContent(UUID normalizedProfileId) {
        String content = normalizedProfileRepository.findById(normalizedProfileId)
                .map(NormalizedProfile::getContent)
                .orElseThrow(() -> new IllegalStateException("Normalized sheet without content"));
        return parse(content);
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JacksonException ex) {
            throw new InvalidMatchingAnalysisException("Unreadable JSON");
        }
    }

    /** Échec courant : replanifie tant que le total reste sous {@link #MAX_ATTEMPTS}, sinon FAILED. */
    private void retryOrFail(MatchingJob job, String message) {
        String error = truncate(message);
        int attempts = job.getAttempts() + 1;
        LocalDateTime now = LocalDateTime.now();
        if (attempts >= MAX_ATTEMPTS) {
            Integer failed = transactionTemplate.execute(txStatus ->
                    matchingJobRepository.casFail(job.getId(), MatchingJobStatus.RUNNING, MatchingJobStatus.FAILED,
                            attempts, now, error));
            log.warn("Matching abandoned after {} attempts : jobId={}, error={}", attempts, job.getId(), error);
            publishIfApplied(failed, job.getId(), MatchingJobStatus.FAILED);
            return;
        }
        LocalDateTime nextAttemptAt = now.plusSeconds(retryDelaySeconds);
        Integer retried = transactionTemplate.execute(txStatus ->
                matchingJobRepository.casRetry(job.getId(), MatchingJobStatus.RUNNING, MatchingJobStatus.PENDING,
                        attempts, nextAttemptAt, error));
        log.info("Matching scheduled for retry : jobId={}, attempt={}, nextAttemptAt={}",
                job.getId(), attempts, nextAttemptAt);
        publishIfApplied(retried, job.getId(), MatchingJobStatus.PENDING);
        scheduleAt(job.getId(), nextAttemptAt);
    }

    /**
     * Push SSE (D60) de la transition qui vient d'être validée, toujours
     * <b>après</b> la tx : un abonné ne voit jamais un statut non commité, et
     * un incident de diffusion ne fait jamais échouer le job.
     */
    private void publishIfApplied(Integer updated, UUID jobId, MatchingJobStatus status) {
        if (updated == null || updated != 1) {
            // Le job n'était plus RUNNING (repris ailleurs) : ce statut n'est pas en base, rien à publier.
            log.warn("Matching transition not applied, nothing pushed : jobId={}, status={}", jobId,
                    status.getApiValue());
            return;
        }
        publishStatus(jobId, status);
    }

    private void publishStatus(UUID jobId, MatchingJobStatus status) {
        try {
            matchingResultRepository.findById(jobId)
                    .ifPresent(result -> matchingStatusBroadcaster.publish(result.getMatchingId(), status));
        } catch (RuntimeException ex) {
            log.warn("Matching status push failed : jobId={}, status={}", jobId, status.getApiValue(), ex);
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
