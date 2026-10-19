package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.service.NormalizationWorker;
import com.linqorbit.matching.client.MatchingAnalyzeClient;
import com.linqorbit.matching.client.MatchingClarifyClient;
import com.linqorbit.matching.dto.MatchingAnalyzeRequest;
import com.linqorbit.matching.dto.MatchingClarifyRequest;
import com.linqorbit.matching.entity.MatchingJobStatus;

/**
 * Matching de bout en bout sur PostgreSQL réel (règle racine : la chaîne FK,
 * l'unicité de l'identité et le versionnement ne se valident que sur la base).
 * Les exécuteurs du worker sont des mocks inertes : aucun dispatch
 * asynchrone, {@code executeJob()} est appelé à la main ; le client IA est
 * mocké. Les fiches normalisées sont semées en SQL (la normalisation réelle
 * est couverte par ses propres tests).
 */
@SpringBootTest
@AutoConfigureMockMvc
class MatchingIntegrationTest {

    private static final String MATCHINGS_PATH = "/api/v1/matchings";
    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String WORK_MODE_ID = "b2000000-0000-4000-8000-000000000001";

    private static final String OFFER_SHEET = """
            {"schemaVersion": "2", "title": "Backend Engineer",
             "requiredSkills": [{"name": "Java", "weight": 4, "level": 4, "minYears": 3, "origin": "declared"},
                                {"name": "Kubernetes", "weight": 2, "origin": "inferred"}],
             "preferredSkills": [{"name": "React", "weight": 1, "origin": "inferred"}],
             "languages": [{"name": "English", "level": "C1", "required": true, "origin": "declared"}],
             "requiredYears": 3, "requiredYearsSource": "declared"}""";
    private static final String CANDIDATE_SHEET = """
            {"schemaVersion": "3", "title": "Backend Engineer", "yearsOfExperience": 11,
             "skills": [{"name": "Java", "level": 4, "yearsExperience": 5, "origin": "declared", "evidence": []}],
             "languages": [{"name": "English", "level": "C2", "origin": "declared", "evidence": []}],
             "experiences": []}""";
    private static final String ANALYSIS = """
            {"schemaVersion": "1", "policyVersion": "generic-1", "assessments": [
              {"criterionKey": "skill:java", "score": 90, "rationale": "Level 4, 5 years.",
               "evidence": [{"source": "skill", "index": 0}]},
              {"criterionKey": "skill:kubernetes", "score": 0, "rationale": "Not shown.", "evidence": []},
              {"criterionKey": "skill:react", "score": 40, "rationale": "Adjacent.",
               "evidence": [{"source": "skill", "index": 0}]},
              {"criterionKey": "language:english", "score": 100, "rationale": "C2.",
               "evidence": [{"source": "language", "index": 0}]},
              {"criterionKey": "experience:total", "score": 100, "rationale": "5 relevant years.",
               "evidence": [{"source": "skill", "index": 0}]}
            ]}""";

    private static final Path STORAGE_ROOT = createStorageRoot();

    @DynamicPropertySource
    static void storageRoot(DynamicPropertyRegistry registry) {
        registry.add("app.attachments.storage-root", () -> STORAGE_ROOT.toString());
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("linqorbit-matching-it");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private MatchingWorker matchingWorker;

    @MockitoBean
    private NormalizationWorker normalizationWorker;
    @MockitoBean
    private MatchingAnalyzeClient matchingAnalyzeClient;
    @MockitoBean
    private MatchingClarifyClient matchingClarifyClient;
    @MockitoBean(name = "matchingExecutor")
    private ThreadPoolTaskExecutor matchingExecutor;
    @MockitoBean(name = "matchingTaskScheduler")
    private TaskScheduler matchingTaskScheduler;
    @MockitoSpyBean
    private MatchingStatusBroadcaster matchingStatusBroadcaster;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    /** Par défaut l'agent n'a plus de question : l'évaluation se clôt à la première analyse. */
    @BeforeEach
    void noQuestionByDefault() {
        when(matchingClarifyClient.clarify(any())).thenReturn("{\"question\": null}");
    }

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            jdbcTemplate.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
            // V22 : référence croisée résultat ↔ clarification — la rompre avant de supprimer (T-62/T-63).
            jdbcTemplate.update("""
                    UPDATE matching_result r SET clarification_id = NULL FROM matching m
                    WHERE r.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_criterion_feedback f USING matching m
                    WHERE f.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM clarification c USING matching m
                    WHERE c.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_job j USING matching_result r, matching m
                    WHERE j.job_id = r.id AND r.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_result r USING matching m
                    WHERE r.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("DELETE FROM matching WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_job_offer npo
                    WHERE npo.normalized_profile_id = j.job_id AND npo.job_offer_id = ?""", offerId);
            jdbcTemplate.update("DELETE FROM normalized_profile_job_offer WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_skill WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_question WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM normalized_profile_candidate WHERE candidate_id = ?", userId);
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        jdbcTemplate.update("""
                DELETE FROM normalized_profile np
                WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                   WHERE npc.normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                   WHERE npo.normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM matching m
                                   WHERE m.candidate_normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM matching_result r
                                   WHERE r.job_offer_normalized_profile_id = np.normalized_profile_id)""");
        for (UUID companyId : createdCompanyIds) {
            jdbcTemplate.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        createdOfferIds.clear();
        createdUserIds.clear();
        createdCompanyIds.clear();
    }

    @Test
    void deuxPremiersLancementsSimultanesNeCreentQuUnSeulMatching() throws Exception {
        Scenario scenario = readyScenario(null);

        // TD-053 : le verrou candidat sérialise les deux lancements — un seul matching, une seule version.
        List<Integer> statuses = twoAtOnce(
                () -> start(scenario.candidateJwt(), scenario.publicId()).andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactly(200, 200);
        assertThat(count("SELECT count(*) FROM matching WHERE candidate_id = ? AND job_offer_id = ?",
                scenario.candidateId(), scenario.offerId())).isOne();
        assertThat(count("""
                SELECT count(*) FROM matching_result r JOIN matching m ON m.id = r.matching_id
                WHERE m.candidate_id = ? AND m.job_offer_id = ?""", scenario.candidateId(), scenario.offerId()))
                .isOne();
    }

    @Test
    void laFicheServieEstLaDerniereAvecContenuEtUneFicheRegenereeFermeLaLecture() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID candidateV1 = jdbcTemplate.queryForObject("""
                SELECT np.normalized_profile_id FROM normalized_profile np
                JOIN normalized_profile_candidate npc ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?""", UUID.class, scenario.candidateId());
        UUID offerV1 = jdbcTemplate.queryForObject("""
                SELECT np.normalized_profile_id FROM normalized_profile np
                JOIN normalized_profile_job_offer npo ON npo.normalized_profile_id = np.normalized_profile_id
                WHERE npo.job_offer_id = ?""", UUID.class, scenario.offerId());
        // Nouvelles versions encore en analyse (content NULL) des deux côtés : jamais servies.
        seedSheet(scenario.candidateId(), null, 2, "3", null);
        seedSheet(null, scenario.offerId(), 2, "2", null);

        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());

        assertThat(jdbcTemplate.queryForObject("SELECT candidate_normalized_profile_id FROM matching WHERE id = ?",
                UUID.class, matchingId)).isEqualTo(candidateV1);
        assertThat(jdbcTemplate.queryForObject("SELECT job_offer_normalized_profile_id FROM matching_result WHERE id = ?",
                UUID.class, latestJobId(matchingId))).isEqualTo(offerV1);

        // Dernière fiche offre au mauvais schéma : l'offre n'est pas évaluable (409), même pour une reprise.
        seedSheet(null, scenario.offerId(), 3, "1", OFFER_SHEET);
        start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.OFFER_NOT_READY));

        // Fiche candidat régénérée (v3 avec contenu) sans relance : plus de matching pour la fiche courante.
        seedSheet(scenario.candidateId(), null, 3, "3", CANDIDATE_SHEET);
        current(scenario.candidateJwt(), scenario.publicId()).andExpect(status().isNotFound());
    }

    @Test
    void abandonnerLeBrouillonConserveLeMatchingDuCouple() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());

        mockMvc.perform(delete("/api/v1/applications/" + scenario.applicationId())
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isNoContent());

        // D59 : le matching appartient au couple, pas au brouillon — il reste lisible.
        assertThat(count("SELECT count(*) FROM matching WHERE id = ?", matchingId)).isOne();
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchingId").value(matchingId.toString()));
    }

    /** Fiche normalisée liée à un candidat ou à une offre ; content null = analyse en cours. */
    private UUID seedSheet(UUID candidateId, UUID offerId, int version, String schemaVersion, String content) {
        UUID sheetId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO normalized_profile (normalized_profile_id, version, schema_version, content, validated_at,
                                                created_at, updated_at)
                VALUES (?, ?, ?, ?::jsonb, now(), now(), now())""", sheetId, version, schemaVersion, content);
        if (candidateId != null) {
            jdbcTemplate.update("""
                    INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES (?, ?)""",
                    sheetId, candidateId);
        } else {
            jdbcTemplate.update("""
                    INSERT INTO normalized_profile_job_offer (normalized_profile_id, job_offer_id) VALUES (?, ?)""",
                    sheetId, offerId);
        }
        return sheetId;
    }

    @Test
    void uneAnalyseQuiVioleLaRegleDePreuveEstRetenteeSansResultatEcrit() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);
        // React noté 40 sans aucune preuve : contraire à la règle de preuve (D61).
        when(matchingAnalyzeClient.analyze(any())).thenReturn("""
                {"schemaVersion": "1", "policyVersion": "skills-3", "assessments": [
                  {"criterionKey": "skill:java", "score": 90, "rationale": "r", "evidence": [{"source": "skill", "index": 0}]},
                  {"criterionKey": "skill:kubernetes", "score": 0, "rationale": "r", "evidence": []},
                  {"criterionKey": "skill:react", "score": 40, "rationale": "r", "evidence": []},
                  {"criterionKey": "language:english", "score": 100, "rationale": "r", "evidence": [{"source": "language", "index": 0}]},
                  {"criterionKey": "experience:total", "score": 100, "rationale": "r", "evidence": [{"source": "skill", "index": 0}]}
                ]}""");

        matchingWorker.executeJob(jobId);

        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
        assertThat(attempts(jobId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT error FROM matching_job WHERE job_id = ?", String.class, jobId))
                .contains("no evidence to a positive score");
        assertThat(jdbcTemplate.queryForObject("SELECT result::text FROM matching_result WHERE id = ?", String.class,
                jobId)).isNull();
        verify(matchingClarifyClient, never()).clarify(any());
        assertThat(count("SELECT count(*) FROM clarification WHERE matching_id = ?", matchingId)).isZero();
    }

    // --- Clarifications IA (T-62, D52) ---------------------------------------

    @Test
    void repondreReevalueAvecLHistoriqueSansPoidsPuisLAgentASecClotLEvaluation() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Which Kubernetes version?", "The offer needs Kubernetes."), NO_QUESTION);
        UUID matchingId = analyzed(scenario);

        // 1er tour : budget complet (plafond 3), aucun historique, les évaluations du tour.
        ArgumentCaptor<MatchingClarifyRequest> firstClarify = ArgumentCaptor.forClass(MatchingClarifyRequest.class);
        verify(matchingClarifyClient).clarify(firstClarify.capture());
        assertThat(firstClarify.getValue().remainingQuestions()).isEqualTo(3);
        assertThat(firstClarify.getValue().clarifications()).isEmpty();
        assertThat(firstClarify.getValue().assessments()).hasSize(5);

        // Vue candidat : question + rationale candidat + budget restant ; jamais poids, justification ni score de section.
        MvcResult read = current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assessmentFinished").value(false))
                .andExpect(jsonPath("$.clarification.question").value("Which Kubernetes version?"))
                .andExpect(jsonPath("$.clarification.rationale").value("The offer needs Kubernetes."))
                .andExpect(jsonPath("$.clarification.remainingQuestions").value(2))
                .andExpect(jsonPath("$.sections[0].score").doesNotExist())
                .andExpect(jsonPath("$.sections[0].criteria[0].weight").doesNotExist())
                .andExpect(jsonPath("$.sections[0].criteria[0].rationale").doesNotExist())
                .andExpect(jsonPath("$.sections[0].criteria[0].evidence").doesNotExist())
                .andReturn();
        assertThat(read.getResponse().getContentAsString()).doesNotContain("weight").doesNotContain("Level 4, 5 years.");
        UUID clarificationId = UUID.fromString(json(read).path("clarification").path("id").asText());
        // Item hérité d'avant la règle de preuve : React à 40 sans preuve dans le résultat stocké.
        jdbcTemplate.update("""
                UPDATE matching_result r SET result = jsonb_set(r.result, '{sections}', (
                    SELECT jsonb_agg(jsonb_set(s, '{criteria}', (
                        SELECT jsonb_agg(CASE WHEN c->>'key' = 'skill:react'
                                              THEN jsonb_set(c, '{evidence}', '[]'::jsonb) ELSE c END)
                        FROM jsonb_array_elements(s->'criteria') c)))
                    FROM jsonb_array_elements(r.result->'sections') s))
                WHERE r.matching_id = ?""", matchingId);

        // Réponse : ANSWERED, nouvelle version liée à la réponse, scores précédents toujours affichés.
        answer(scenario, clarificationId, "  I ran Kubernetes clusters for 2 years.  ")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("pending"))
                .andExpect(jsonPath("$.clarification").doesNotExist())
                .andExpect(jsonPath("$.sections[0].criteria[0].score").value(90));
        assertThat(jdbcTemplate.queryForMap("SELECT status, answer, answered_at FROM clarification WHERE id = ?",
                clarificationId)).containsEntry("status", 2)
                .containsEntry("answer", "I ran Kubernetes clusters for 2 years.")
                .extractingByKey("answered_at").isNotNull();
        UUID reevaluation = latestJobId(matchingId);
        assertThat(jdbcTemplate.queryForMap("SELECT version, clarification_id FROM matching_result WHERE id = ?",
                reevaluation)).containsEntry("version", 2).containsEntry("clarification_id", clarificationId);

        ArgumentCaptor<MatchingAnalyzeRequest> analyzed = ArgumentCaptor.forClass(MatchingAnalyzeRequest.class);
        matchingWorker.executeJob(reevaluation);
        verify(matchingAnalyzeClient, org.mockito.Mockito.times(2)).analyze(analyzed.capture());
        MatchingAnalyzeRequest second = analyzed.getAllValues().get(1);
        // Évaluations précédentes : clé, score, justification, preuves — jamais le poids ; les items
        // incohérents avec la règle de preuve (score > 0 sans preuve, D61) ne sont pas rejoués.
        assertThat(objectMapper.writeValueAsString(second.previousAssessments())).doesNotContain("weight");
        assertThat(second.previousAssessments()).extracting(node -> node.path("criterionKey").asText())
                .containsExactlyInAnyOrder("skill:java", "skill:kubernetes", "language:english", "experience:total");
        assertThat(second.clarifications()).singleElement().satisfies(history -> {
            assertThat(history.question()).isEqualTo("Which Kubernetes version?");
            assertThat(history.answer()).isEqualTo("I ran Kubernetes clusters for 2 years.");
            assertThat(history.status()).isEqualTo("answered");
        });

        // Agent à sec : évaluation close, plus de question.
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.status").value("done"))
                .andExpect(jsonPath("$.assessmentFinished").value(true))
                .andExpect(jsonPath("$.clarification").doesNotExist());
        mockMvc.perform(get("/api/v1/applications/context/" + scenario.publicId())
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(jsonPath("$.assessment.matched").value(true))
                .andExpect(jsonPath("$.assessment.assessmentFinished").value(true))
                .andExpect(jsonPath("$.assessment.contested").value(false));
    }

    @Test
    void passerConsommeUnCranEtLePlafondAtteintClotSansNouvelAppelIA() throws Exception {
        Scenario scenario = readyScenario(null);
        jdbcTemplate.update("UPDATE job_offer SET max_clarification_questions = 2 WHERE id = ?", scenario.offerId());
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."), question("Q2?", "R2."));
        UUID matchingId = analyzed(scenario);
        UUID first = openClarification(matchingId);

        skip(scenario, first).andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("pending"));
        assertThat(jdbcTemplate.queryForMap("SELECT status, answer, answered_at FROM clarification WHERE id = ?", first))
                .containsEntry("status", 3).containsEntry("answer", null).containsEntry("answered_at", null);
        UUID afterSkip = latestJobId(matchingId);
        assertThat(jdbcTemplate.queryForObject("SELECT clarification_id FROM matching_result WHERE id = ?", UUID.class,
                afterSkip)).isNull();
        matchingWorker.executeJob(afterSkip);

        ArgumentCaptor<MatchingClarifyRequest> clarified = ArgumentCaptor.forClass(MatchingClarifyRequest.class);
        verify(matchingClarifyClient, org.mockito.Mockito.times(2)).clarify(clarified.capture());
        MatchingClarifyRequest secondRound = clarified.getAllValues().get(1);
        assertThat(secondRound.remainingQuestions()).isEqualTo(1);
        assertThat(secondRound.clarifications()).singleElement().satisfies(history -> {
            assertThat(history.status()).isEqualTo("skipped");
            assertThat(history.answer()).isNull();
        });
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.clarification.question").value("Q2?"))
                .andExpect(jsonPath("$.clarification.remainingQuestions").value(0));

        // Plafond atteint (2 questions posées) : la réévaluation clôt sans appeler l'agent clarify.
        answer(scenario, openClarification(matchingId), "Yes.").andExpect(status().isAccepted());
        matchingWorker.executeJob(latestJobId(matchingId));
        verify(matchingClarifyClient, org.mockito.Mockito.times(2)).clarify(any());
        assertThat(count("SELECT count(*) FROM clarification WHERE matching_id = ?", matchingId)).isEqualTo(2);
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.assessmentFinished").value(true))
                .andExpect(jsonPath("$.clarification").doesNotExist());
    }

    @Test
    void plafondZeroClotLEvaluationDesLAnalyseInitialeSansAppelIA() throws Exception {
        Scenario scenario = readyScenario(null);
        jdbcTemplate.update("UPDATE job_offer SET max_clarification_questions = 0 WHERE id = ?", scenario.offerId());

        UUID matchingId = analyzed(scenario);

        verify(matchingClarifyClient, never()).clarify(any());
        assertThat(jdbcTemplate.queryForObject("SELECT assessment_finished_at FROM matching WHERE id = ?",
                java.time.LocalDateTime.class, matchingId)).isNotNull();
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.assessmentFinished").value(true))
                .andExpect(jsonPath("$.clarification").doesNotExist());
    }

    @Test
    void terminerFermeLaQuestionEstIdempotenteEtRefuseePendantUneAnalyse() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."), question("Q2?", "R2."));
        UUID matchingId = analyzed(scenario);
        UUID first = openClarification(matchingId);
        answer(scenario, first, "An answer.").andExpect(status().isAccepted());

        // Réévaluation en vol : ni fin, ni nouvelle réponse.
        finish(scenario).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.ANALYSIS_RUNNING));
        answer(scenario, first, "Again.").andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.QUESTION_CLOSED));
        matchingWorker.executeJob(latestJobId(matchingId));
        UUID second = openClarification(matchingId);

        finish(scenario).andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM clarification WHERE id = ?", Short.class, second))
                .isEqualTo((short) 3);
        java.time.LocalDateTime finishedAt = jdbcTemplate.queryForObject(
                "SELECT assessment_finished_at FROM matching WHERE id = ?", java.time.LocalDateTime.class, matchingId);
        assertThat(finishedAt).isNotNull();
        finish(scenario).andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT assessment_finished_at FROM matching WHERE id = ?",
                java.time.LocalDateTime.class, matchingId)).isEqualTo(finishedAt);
        skip(scenario, second).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.QUESTION_CLOSED));
        // Aucune réévaluation après la fin : la fin ne crée ni résultat ni job.
        assertThat(count("SELECT count(*) FROM matching_result WHERE matching_id = ?", matchingId)).isEqualTo(2);
    }

    @Test
    void refusDesReponsesInvalidesOuInconnues() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."));
        UUID matchingId = analyzed(scenario);
        UUID open = openClarification(matchingId);

        answer(scenario, UUID.randomUUID(), "Text").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value(MatchingService.QUESTION_NOT_FOUND));
        answer(scenario, open, "   ").andExpect(status().isBadRequest());
        answer(scenario, open, "x".repeat(3001)).andExpect(status().isBadRequest());
        mockMvc.perform(post(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/clarifications/not-a-uuid/skip")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/clarifications/" + open + "/skip"))
                .andExpect(status().isUnauthorized());
        // Rien n'a bougé : la question reste ouverte, aucune réévaluation.
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM clarification WHERE id = ?", Short.class, open))
                .isEqualTo((short) 1);
        assertThat(count("SELECT count(*) FROM matching_result WHERE matching_id = ?", matchingId)).isOne();
    }

    @Test
    void uneRelanceApresEchecRejoueToutLHistoriqueReponsesComprises() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."), NO_QUESTION);
        UUID matchingId = analyzed(scenario);
        answer(scenario, openClarification(matchingId), "My answer.").andExpect(status().isAccepted());
        // La réévaluation a épuisé ses tentatives (4 = FAILED).
        jdbcTemplate.update("UPDATE matching_job SET status = 4 WHERE job_id = ?", latestJobId(matchingId));

        start(scenario.candidateJwt(), scenario.publicId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"));
        UUID relaunch = latestJobId(matchingId);
        assertThat(jdbcTemplate.queryForMap("SELECT version, clarification_id FROM matching_result WHERE id = ?",
                relaunch)).containsEntry("version", 3).containsEntry("clarification_id", null);
        matchingWorker.executeJob(relaunch);

        ArgumentCaptor<MatchingAnalyzeRequest> analyzedRequests = ArgumentCaptor.forClass(MatchingAnalyzeRequest.class);
        verify(matchingAnalyzeClient, org.mockito.Mockito.times(2)).analyze(analyzedRequests.capture());
        assertThat(analyzedRequests.getAllValues().get(1).clarifications()).singleElement()
                .satisfies(history -> assertThat(history.answer()).isEqualTo("My answer."));
    }

    @Test
    void contraintesV22SurLaBaseReelle() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."));
        UUID matchingId = analyzed(scenario);
        UUID open = openClarification(matchingId);
        UUID resultId = jdbcTemplate.queryForObject("SELECT matching_result_id FROM clarification WHERE id = ?",
                UUID.class, open);

        // Une seule question ouverte par matching (index partiel).
        assertThatThrownBy(() -> insertClarification(matchingId, resultId, 1))
                .isInstanceOf(DataIntegrityViolationException.class);
        insertClarification(matchingId, resultId, 3);
        // Statut hors 1–3.
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE clarification SET status = 4 WHERE id = ?", open))
                .isInstanceOf(DataIntegrityViolationException.class);
        // FK composite : un résultat d'un autre matching est refusé, dans les deux sens.
        Scenario other = readyScenario(null);
        UUID otherMatching = analyzed(other);
        assertThatThrownBy(() -> insertClarification(otherMatching, resultId, 3))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE matching_result SET clarification_id = ? WHERE id = ?",
                open, latestJobId(otherMatching))).isInstanceOf(DataIntegrityViolationException.class);
        // Plafond d'offre 0–10.
        jdbcTemplate.update("UPDATE job_offer SET max_clarification_questions = 0 WHERE id = ?", scenario.offerId());
        jdbcTemplate.update("UPDATE job_offer SET max_clarification_questions = 10 WHERE id = ?", scenario.offerId());
        for (int invalid : new int[] {-1, 11}) {
            assertThatThrownBy(() -> jdbcTemplate.update(
                    "UPDATE job_offer SET max_clarification_questions = ? WHERE id = ?", invalid, scenario.offerId()))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Test
    void terminerSansResultatTermineEst409EtNeChangeRien() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        // L'unique analyse a échoué (4 = FAILED) : aucun résultat terminé à contester.
        jdbcTemplate.update("UPDATE matching_job SET status = 4 WHERE job_id = ?", latestJobId(matchingId));

        finish(scenario).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.NOTHING_TO_REVIEW));

        assertThat(jdbcTemplate.queryForObject("SELECT assessment_finished_at FROM matching WHERE id = ?",
                java.time.LocalDateTime.class, matchingId)).isNull();
    }

    @Test
    void terminerAccepteUnResultatAnterieurQuandLaDerniereAnalyseAEchoue() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."));
        UUID matchingId = analyzed(scenario);
        answer(scenario, openClarification(matchingId), "An answer.").andExpect(status().isAccepted());
        jdbcTemplate.update("UPDATE matching_job SET status = 4 WHERE job_id = ?", latestJobId(matchingId));

        finish(scenario).andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject("SELECT assessment_finished_at FROM matching WHERE id = ?",
                java.time.LocalDateTime.class, matchingId)).isNotNull();
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.assessmentFinished").value(true))
                .andExpect(jsonPath("$.sections[0].criteria[0].score").value(90));
    }

    @Test
    void terminerUneEvaluationNormaleEstAccepte() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."));
        UUID matchingId = analyzed(scenario);

        finish(scenario).andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject("SELECT status FROM clarification WHERE id = ?", Short.class,
                openClarificationOrClosed(matchingId))).isEqualTo((short) 3);
    }

    /**
     * M4 (D59 §7) : la transmission reste possible pendant une analyse. Une
     * analyse encore en vol peut alors ouvrir une question APRÈS la
     * transmission — elle reste inatteignable (accès matching fermé).
     */
    @Test
    void transmettrePendantUneAnalyseFermeLAccesMemeSiUneQuestionArriveEnsuite() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingAnalyzeClient.analyze(any())).thenReturn(ANALYSIS);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Late question?", "Late."));
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);
        jdbcTemplate.update("UPDATE matching_job SET status = 2, started_at = now() WHERE job_id = ?", jobId);

        mockMvc.perform(post("/api/v1/applications/" + scenario.applicationId() + "/submit")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("submitted"));

        // L'analyse en vol se termine après la transmission (rejouée ici depuis PENDING) et ouvre une question.
        jdbcTemplate.update("UPDATE matching_job SET status = 1 WHERE job_id = ?", jobId);
        matchingWorker.executeJob(jobId);
        UUID late = openClarification(matchingId);

        current(scenario.candidateJwt(), scenario.publicId()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.CLOSED));
        answer(scenario, late, "Too late.").andExpect(status().isConflict());
        skip(scenario, late).andExpect(status().isConflict());
        assertThat(jdbcTemplate.queryForObject("SELECT status FROM clarification WHERE id = ?", Short.class, late))
                .isEqualTo((short) 1);
        mockMvc.perform(get("/api/v1/applications/context/" + scenario.publicId())
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(jsonPath("$.step").value("submitted"))
                .andExpect(jsonPath("$.assessment.matched").value(true));
    }

    /** La question du matching, quel que soit son statut (au plus une ici). */
    private UUID openClarificationOrClosed(UUID matchingId) {
        return jdbcTemplate.queryForObject("SELECT id FROM clarification WHERE matching_id = ?", UUID.class,
                matchingId);
    }

    // --- Contestation (T-63, D54 révisée par D62) --------------------------------

    @Test
    void contestationRemplaceTouteLaListeSansJamaisToucherAuResultat() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = analyzed(scenario);
        UUID resultId = latestJobId(matchingId);
        String snapshot = jdbcTemplate.queryForObject("SELECT result::text FROM matching_result WHERE id = ?",
                String.class, resultId);

        saveFeedback(scenario, """
                [{"criterionKey": "skill:java", "selfValue": 60, "comment": "  I led the Java migration.  "},
                 {"criterionKey": "skill:kubernetes", "selfValue": 30, "comment": "   "}]""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.items[0].comment").value("I led the Java migration."))
                .andExpect(jsonPath("$.items[1].criterionKey").value("skill:kubernetes"))
                .andExpect(jsonPath("$.items[1].comment").doesNotExist());
        java.time.LocalDateTime createdAt = jdbcTemplate.queryForObject("""
                SELECT created_at FROM matching_criterion_feedback
                WHERE matching_result_id = ? AND criterion_key = 'skill:java'""", java.time.LocalDateTime.class, resultId);

        // Remplacement complet : item absent supprimé, created_at conservé, updated_at avancé.
        saveFeedback(scenario, "[{\"criterionKey\": \"skill:java\", \"selfValue\": 70}]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].selfValue").value(70));
        Map<String, Object> javaRow = jdbcTemplate.queryForMap("""
                SELECT created_at, updated_at, comment FROM matching_criterion_feedback
                WHERE matching_result_id = ? AND criterion_key = 'skill:java'""", resultId);
        assertThat(javaRow.get("created_at")).isEqualTo(java.sql.Timestamp.valueOf(createdAt));
        assertThat(((java.sql.Timestamp) javaRow.get("updated_at")).toLocalDateTime()).isAfterOrEqualTo(createdAt);
        assertThat(javaRow.get("comment")).isNull();
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.feedback[0].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.feedback[0].selfValue").value(70));
        mockMvc.perform(get("/api/v1/applications/context/" + scenario.publicId())
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(jsonPath("$.assessment.contested").value(true));

        // Liste vide : tout effacer.
        saveFeedback(scenario, "[]").andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        assertThat(count("SELECT count(*) FROM matching_criterion_feedback WHERE matching_id = ?", matchingId)).isZero();

        // Aucun recalcul : le résultat, ses versions et ses scores sont intacts.
        assertThat(jdbcTemplate.queryForObject("SELECT result::text FROM matching_result WHERE id = ?", String.class,
                resultId)).isEqualTo(snapshot);
        assertThat(count("SELECT count(*) FROM matching_result WHERE matching_id = ?", matchingId)).isOne();
    }

    @Test
    void contestationRefuseLesEntreesInvalides() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = analyzed(scenario);

        saveFeedback(scenario, """
                [{"criterionKey": "skill:java", "selfValue": 60}, {"criterionKey": "skill:java", "selfValue": 70}]""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(MatchingService.DUPLICATE_CRITERION));
        saveFeedback(scenario, "[{\"criterionKey\": \"skill:cobol\", \"selfValue\": 60}]")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(MatchingService.UNKNOWN_CRITERION));
        saveFeedback(scenario, "[{\"criterionKey\": \"skill:java\", \"selfValue\": 60, \"comment\": \""
                + "x".repeat(2001) + "\"}]")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(MatchingService.COMMENT_TOO_LONG));
        for (String invalid : List.of("[{\"criterionKey\": \"skill:java\", \"selfValue\": 101}]",
                "[{\"criterionKey\": \"skill:java\", \"selfValue\": -1}]",
                "[{\"criterionKey\": \"skill:java\"}]",
                "[{\"criterionKey\": \"\", \"selfValue\": 50}]",
                "[null]")) {
            saveFeedback(scenario, invalid).andExpect(status().isBadRequest());
        }
        mockMvc.perform(put(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/feedback")
                        .header("Authorization", "Bearer " + scenario.candidateJwt())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        assertThat(count("SELECT count(*) FROM matching_criterion_feedback WHERE matching_id = ?", matchingId)).isZero();
    }

    @Test
    void contestationSoumiseAuxPreconditionsPuisFigeeALaTransmission() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingClarifyClient.clarify(any())).thenReturn(question("Q1?", "R1."));
        UUID matchingId = analyzed(scenario);
        String item = "[{\"criterionKey\": \"skill:java\", \"selfValue\": 60}]";

        // Évaluation encore ouverte (une question attend).
        saveFeedback(scenario, item).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.ASSESSMENT_OPEN));
        finish(scenario).andExpect(status().isNoContent());
        // Analyse en cours (dernier job PENDING).
        UUID job = latestJobId(matchingId);
        jdbcTemplate.update("UPDATE matching_job SET status = 1 WHERE job_id = ?", job);
        saveFeedback(scenario, item).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.ANALYSIS_RUNNING));
        jdbcTemplate.update("UPDATE matching_job SET status = 3 WHERE job_id = ?", job);
        saveFeedback(scenario, item).andExpect(status().isOk());

        // Transmise : figée (409), puis retirée : toujours figée.
        mockMvc.perform(post("/api/v1/applications/" + scenario.applicationId() + "/submit")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isOk());
        saveFeedback(scenario, "[]").andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.CLOSED));
        mockMvc.perform(post("/api/v1/applications/" + scenario.applicationId() + "/withdraw")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isNoContent());
        saveFeedback(scenario, "[]").andExpect(status().isConflict());
        assertThat(count("SELECT count(*) FROM matching_criterion_feedback WHERE matching_id = ?", matchingId)).isOne();
        // Le contexte transmis lit le matching rattaché à la candidature.
        mockMvc.perform(get("/api/v1/applications/context/" + scenario.publicId())
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(jsonPath("$.step").value("submitted"))
                .andExpect(jsonPath("$.assessment.matched").value(true))
                .andExpect(jsonPath("$.assessment.contested").value(true));
    }

    @Test
    void contraintesV23SurLaBaseReelle() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = analyzed(scenario);
        UUID resultId = latestJobId(matchingId);
        insertFeedback(matchingId, resultId, "skill:java", 50);

        assertThatThrownBy(() -> insertFeedback(matchingId, resultId, "skill:java", 60))
                .isInstanceOf(DataIntegrityViolationException.class);
        for (int invalid : new int[] {-1, 101}) {
            assertThatThrownBy(() -> insertFeedback(matchingId, resultId, "skill:kubernetes", invalid))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
        Scenario other = readyScenario(null);
        UUID otherMatching = analyzed(other);
        assertThatThrownBy(() -> insertFeedback(otherMatching, resultId, "skill:react", 50))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static final String NO_QUESTION = "{\"question\": null}";

    private static String question(String text, String rationale) {
        return "{\"question\": {\"question\": \"" + text + "\", \"rationale\": \"" + rationale + "\"}}";
    }

    /** Lancement puis analyse initiale exécutée (analyse IA stubée) ; renvoie le matching. */
    private UUID analyzed(Scenario scenario) throws Exception {
        when(matchingAnalyzeClient.analyze(any())).thenReturn(ANALYSIS);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        matchingWorker.executeJob(latestJobId(matchingId));
        return matchingId;
    }

    private UUID openClarification(UUID matchingId) {
        return jdbcTemplate.queryForObject("SELECT id FROM clarification WHERE matching_id = ? AND status = 1",
                UUID.class, matchingId);
    }

    private ResultActions answer(Scenario scenario, UUID clarificationId, String text) throws Exception {
        return mockMvc.perform(post(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/clarifications/"
                        + clarificationId + "/answer")
                .header("Authorization", "Bearer " + scenario.candidateJwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("answer", text))));
    }

    private ResultActions skip(Scenario scenario, UUID clarificationId) throws Exception {
        return mockMvc.perform(post(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/clarifications/"
                        + clarificationId + "/skip")
                .header("Authorization", "Bearer " + scenario.candidateJwt()));
    }

    private ResultActions finish(Scenario scenario) throws Exception {
        return mockMvc.perform(post(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/assessment/finish")
                .header("Authorization", "Bearer " + scenario.candidateJwt()));
    }

    private ResultActions saveFeedback(Scenario scenario, String itemsJson) throws Exception {
        return mockMvc.perform(put(MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/feedback")
                .header("Authorization", "Bearer " + scenario.candidateJwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\": " + itemsJson + "}"));
    }

    private void insertClarification(UUID matchingId, UUID resultId, int status) {
        jdbcTemplate.update("""
                INSERT INTO clarification (id, matching_id, matching_result_id, question, status, created_at)
                VALUES (?, ?, ?, 'Seeded?', ?, now())""", UUID.randomUUID(), matchingId, resultId, status);
    }

    private void insertFeedback(UUID matchingId, UUID resultId, String key, int selfValue) {
        jdbcTemplate.update("""
                INSERT INTO matching_criterion_feedback (id, matching_id, matching_result_id, criterion_key,
                                                         self_value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, now(), now())""", UUID.randomUUID(), matchingId, resultId, key, selfValue);
    }

    // --- Push SSE de bout en bout (D60) : vraie sécurité, vrai flux, deux candidats sur la même offre ---

    @Test
    void fluxSseReelNePousseQueLesTransitionsDuCandidatEtSeFermeSurTerminal() throws Exception {
        Scenario mine = readyScenario(null);
        // Second candidat, même offre : son propre brouillon, sa propre fiche, donc son propre matching.
        String otherJwt = signup();
        UUID otherId = lastUserId();
        uploadCv(otherJwt);
        seedCandidateSheet(otherId, 1, "3");
        saveDraft(otherJwt, mine.publicId(), "[]");
        UUID myMatching = UUID.fromString(json(start(mine.candidateJwt(), mine.publicId()).andReturn())
                .get("matchingId").asText());
        UUID theirMatching = UUID.fromString(json(start(otherJwt, mine.publicId()).andReturn())
                .get("matchingId").asText());
        assertThat(theirMatching).isNotEqualTo(myMatching);

        MvcResult myStream = openStream(mine.candidateJwt(), mine.publicId());
        MvcResult theirStream = openStream(otherJwt, mine.publicId());
        when(matchingAnalyzeClient.analyze(any())).thenReturn(ANALYSIS);
        matchingWorker.executeJob(latestJobId(myMatching));

        mockMvc.perform(asyncDispatch(myStream)).andExpect(status().isOk());
        String mineBody = myStream.getResponse().getContentAsString();
        assertThat(mineBody).contains("event:status");
        assertThat(mineBody).contains("\"matchingId\":\"" + myMatching + "\"");
        assertThat(mineBody).contains("\"status\":\"pending\"", "\"status\":\"running\"", "\"status\":\"done\"");
        // L'autre candidat n'a reçu que son propre statut courant : rien de mon matching, flux encore ouvert.
        String theirBody = theirStream.getResponse().getContentAsString();
        assertThat(theirBody).contains("\"matchingId\":\"" + theirMatching + "\"", "\"status\":\"pending\"");
        assertThat(theirBody).doesNotContain(myMatching.toString()).doesNotContain("\"status\":\"done\"");
        assertThat(theirStream.getRequest().isAsyncStarted()).isTrue();

        // Analyse déjà terminée à l'abonnement : le statut final est envoyé puis le flux se ferme.
        MvcResult replay = openStream(mine.candidateJwt(), mine.publicId());
        mockMvc.perform(asyncDispatch(replay)).andExpect(status().isOk());
        assertThat(replay.getResponse().getContentAsString()).contains("\"status\":\"done\"")
                .doesNotContain("\"status\":\"pending\"");
    }

    @Test
    void fluxSseRefuseSansJetonSansMatchingEtApresTransmission() throws Exception {
        Scenario scenario = readyScenario(null);
        String eventsPath = MATCHINGS_PATH + "/offer/" + scenario.publicId() + "/events";

        mockMvc.perform(get(eventsPath).accept(MediaType.TEXT_EVENT_STREAM)).andExpect(status().isUnauthorized());
        // Aucun matching lancé : 404 avant toute ouverture de flux.
        mockMvc.perform(get(eventsPath).header("Authorization", "Bearer " + scenario.candidateJwt())
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound())
                .andExpect(request().asyncNotStarted());

        start(scenario.candidateJwt(), scenario.publicId()).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/applications/" + scenario.applicationId() + "/submit")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isOk());
        // Candidature transmise : accès fermé, même pour le flux.
        mockMvc.perform(get(eventsPath).header("Authorization", "Bearer " + scenario.candidateJwt())
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isConflict())
                .andExpect(request().asyncNotStarted());
    }

    private MvcResult openStream(String token, String publicId) throws Exception {
        return mockMvc.perform(get(MATCHINGS_PATH + "/offer/" + publicId + "/events")
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    // --- Worker : déclenchement, rejet du pool, recovery, CAS (miroir NormalizationWorkerIntegrationTest) ---

    @Test
    void lancementHttpSoumetLAnalyseAuPoolApresCommit() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingAnalyzeClient.analyze(any())).thenReturn(ANALYSIS);

        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);

        takeDispatched().run();

        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.DONE);
    }

    @Test
    void soumissionAuPoolRejeteePlanifieUneReSoumission() throws Exception {
        Scenario scenario = readyScenario(null);
        when(matchingAnalyzeClient.analyze(any())).thenReturn(ANALYSIS);
        UUID jobId = latestJobId(UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andReturn()).get("matchingId").asText()));
        clearInvocations(matchingExecutor);
        // 1re soumission rejetée (queue saturée) ; la re-soumission planifiée s'exécute.
        doThrow(new RejectedExecutionException("queue saturée"))
                .doAnswer(invocation -> {
                    ((Runnable) invocation.getArgument(0)).run();
                    return null;
                })
                .when(matchingExecutor).execute(any(Runnable.class));
        Instant before = Instant.now();

        matchingWorker.onMatchingRequested(new MatchingRequestedEvent(jobId));

        ArgumentCaptor<Runnable> scheduled = ArgumentCaptor.forClass(Runnable.class);
        ArgumentCaptor<Instant> at = ArgumentCaptor.forClass(Instant.class);
        verify(matchingTaskScheduler).schedule(scheduled.capture(), at.capture());
        assertThat(at.getValue()).isAfterOrEqualTo(before.plusSeconds(59));
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
        scheduled.getValue().run();
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.DONE);
    }

    @Test
    void recoveryReplanifieUnRunningPerimeEtPublieLeRetourEnAttente() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);
        // Statut SMALLINT : 2 = RUNNING, démarré il y a 11 min (worker présumé mort).
        jdbcTemplate.update("UPDATE matching_job SET status = 2, started_at = ? WHERE job_id = ?",
                LocalDateTime.now().minusMinutes(11), jobId);

        matchingWorker.recoverOrphanJobs();

        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
        assertThat(attempts(jobId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT error FROM matching_job WHERE job_id = ?", String.class,
                jobId)).isEqualTo("Worker presumed dead before completion");
        verify(matchingStatusBroadcaster).publish(matchingId, MatchingJobStatus.PENDING);
    }

    @Test
    void recoveryPlanifieUnJobEnAttenteASonEcheance() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID jobId = latestJobId(UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andReturn()).get("matchingId").asText()));
        jdbcTemplate.update("UPDATE matching_job SET next_attempt_at = ? WHERE job_id = ?",
                LocalDateTime.now().plusMinutes(30), jobId);
        Instant before = Instant.now();

        matchingWorker.recoverOrphanJobs();

        ArgumentCaptor<Instant> at = ArgumentCaptor.forClass(Instant.class);
        verify(matchingTaskScheduler, atLeastOnce()).schedule(any(Runnable.class), at.capture());
        assertThat(at.getAllValues()).anySatisfy(instant -> assertThat(instant)
                .isAfterOrEqualTo(before.plusSeconds(29 * 60))
                .isBeforeOrEqualTo(before.plusSeconds(31 * 60)));
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
    }

    @Test
    void aucunPushQuandLaTransitionNEstPasAppliqueeEnBase() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);
        // Pendant l'appel IA, le job quitte RUNNING ailleurs (4 = FAILED) : le CAS DONE ne s'applique pas.
        when(matchingAnalyzeClient.analyze(any())).thenAnswer(invocation -> {
            jdbcTemplate.update("UPDATE matching_job SET status = 4 WHERE job_id = ?", jobId);
            return ANALYSIS;
        });

        matchingWorker.executeJob(jobId);

        verify(matchingStatusBroadcaster).publish(matchingId, MatchingJobStatus.RUNNING);
        verify(matchingStatusBroadcaster, never()).publish(matchingId, MatchingJobStatus.DONE);
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.FAILED);
    }

    private Runnable takeDispatched() {
        ArgumentCaptor<Runnable> dispatched = ArgumentCaptor.forClass(Runnable.class);
        verify(matchingExecutor).execute(dispatched.capture());
        clearInvocations(matchingExecutor);
        return dispatched.getValue();
    }

    @Test
    void lancementAnalyseLectureRepriseEtRattachementALaTransmission() throws Exception {
        Scenario scenario = readyScenario(null);
        ArgumentCaptor<MatchingAnalyzeRequest> request = ArgumentCaptor.forClass(MatchingAnalyzeRequest.class);
        when(matchingAnalyzeClient.analyze(request.capture())).thenReturn(ANALYSIS);

        MvcResult started = start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"))
                .andExpect(jsonPath("$.sections.length()").value(0))
                .andReturn();
        UUID matchingId = UUID.fromString(json(started).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);
        assertThat(count("SELECT count(*) FROM matching_result WHERE matching_id = ?", matchingId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT result::text FROM matching_result WHERE id = ?", String.class,
                jobId)).isNull();
        current(scenario.candidateJwt(), scenario.publicId()).andExpect(jsonPath("$.status").value("pending"));

        matchingWorker.executeJob(jobId);

        // Push SSE (D60) : chaque transition validée est publiée, dans l'ordre.
        InOrder pushes = inOrder(matchingStatusBroadcaster);
        pushes.verify(matchingStatusBroadcaster).publish(matchingId, MatchingJobStatus.RUNNING);
        pushes.verify(matchingStatusBroadcaster).publish(matchingId, MatchingJobStatus.DONE);

        // Contexte rejoué : les deux fiches entières et les critères à clés stables, sans poids.
        MatchingAnalyzeRequest sent = request.getValue();
        assertThat(sent.matchingId()).isEqualTo(matchingId.toString());
        assertThat(sent.candidate().path("schemaVersion").asText()).isEqualTo("3");
        assertThat(sent.offer().path("schemaVersion").asText()).isEqualTo("2");
        assertThat(sent.criteria()).extracting(criterion -> criterion.key()).containsExactly("skill:java",
                "skill:kubernetes", "skill:react", "language:english", "experience:total");
        assertThat(objectMapper.writeValueAsString(sent.criteria())).doesNotContain("weight");

        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.DONE);
        JsonNode stored = objectMapper.readTree(jdbcTemplate.queryForObject(
                "SELECT result::text FROM matching_result WHERE id = ?", String.class, jobId));
        assertThat(stored.path("scoringVersion").asText()).isEqualTo(MatchingScoring.SCORING_VERSION);
        // Obligatoires : (4×90 + 2×0) / 6 = 60 ; l'inféré (Kubernetes) compte comme le déclaré.
        assertThat(stored.path("sections").get(0).path("score").asDouble()).isEqualTo(60.0);

        // Vue candidat : le score de chaque critère, rien d'autre.
        MvcResult read = current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("done"))
                .andExpect(jsonPath("$.sections.length()").value(4))
                .andExpect(jsonPath("$.sections[0].section").value("required_skills"))
                .andExpect(jsonPath("$.sections[0].criteria[0].key").value("skill:java"))
                .andExpect(jsonPath("$.sections[0].criteria[0].label").value("Java"))
                .andExpect(jsonPath("$.sections[0].criteria[0].score").value(90))
                .andReturn();
        String body = read.getResponse().getContentAsString();
        assertThat(body).doesNotContain("weight", "rationale", "evidence", "requirement", "\"score\":60");

        // Reprise : même matching, aucune nouvelle version.
        start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchingId").value(matchingId.toString()))
                .andExpect(jsonPath("$.status").value("done"));
        assertThat(count("SELECT count(*) FROM matching_result WHERE matching_id = ?", matchingId)).isEqualTo(1);

        // Transmission : matching_id posé par le serveur, puis accès fermé.
        mockMvc.perform(post("/api/v1/applications/" + scenario.applicationId() + "/submit")
                        .header("Authorization", "Bearer " + scenario.candidateJwt()))
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject("SELECT matching_id FROM application WHERE id = ?", UUID.class,
                scenario.applicationId())).isEqualTo(matchingId);
        start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.CLOSED));
        current(scenario.candidateJwt(), scenario.publicId()).andExpect(status().isConflict());
    }

    @Test
    void echecsDuWorkerRetriesPuisFailedEtRelanceEnVersionSuivante() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID matchingId = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk()).andReturn()).get("matchingId").asText());
        UUID jobId = latestJobId(matchingId);

        // 1er échec : service IA en panne → retry planifié.
        when(matchingAnalyzeClient.analyze(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."));
        matchingWorker.executeJob(jobId);
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
        assertThat(attempts(jobId)).isEqualTo(1);

        // 2e échec : analyse inexploitable (un critère manque) → retry.
        // doReturn : réécrire un bouchon qui lève sans rappeler la méthode bouchonnée.
        doReturn("""
                {"policyVersion": "generic-1", "assessments": [
                  {"criterionKey": "skill:java", "score": 90, "rationale": "r",
                   "evidence": [{"source": "skill", "index": 0}]}]}""").when(matchingAnalyzeClient).analyze(any());
        matchingWorker.executeJob(jobId);
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.PENDING);
        assertThat(attempts(jobId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT error FROM matching_job WHERE job_id = ?", String.class,
                jobId)).contains("missed criterion");

        // 3e échec : FAILED terminal, aucun score exposé.
        doReturn("not json").when(matchingAnalyzeClient).analyze(any());
        matchingWorker.executeJob(jobId);
        assertThat(jobStatus(jobId)).isEqualTo(MatchingJobStatus.FAILED);
        assertThat(attempts(jobId)).isEqualTo(3);
        // Push SSE : running puis pending à chaque retry, puis failed.
        verify(matchingStatusBroadcaster, org.mockito.Mockito.times(3)).publish(matchingId, MatchingJobStatus.RUNNING);
        verify(matchingStatusBroadcaster, org.mockito.Mockito.times(2)).publish(matchingId, MatchingJobStatus.PENDING);
        verify(matchingStatusBroadcaster).publish(matchingId, MatchingJobStatus.FAILED);
        // Un job terminal ne se réexécute jamais (claim CAS).
        matchingWorker.executeJob(jobId);
        assertThat(attempts(jobId)).isEqualTo(3);
        current(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.status").value("failed"))
                .andExpect(jsonPath("$.sections.length()").value(0));

        // Relance : même matching, version 2, nouveau job PENDING.
        start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(jsonPath("$.matchingId").value(matchingId.toString()))
                .andExpect(jsonPath("$.status").value("pending"));
        assertThat(jdbcTemplate.queryForList("SELECT version FROM matching_result WHERE matching_id = ? ORDER BY version",
                Integer.class, matchingId)).containsExactly(1, 2);
    }

    @Test
    void ficheRegenereeDonneUnNouveauMatchingEtLaBaseVerrouilleIdentiteEtVersions() throws Exception {
        Scenario scenario = readyScenario(null);
        UUID firstMatching = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andReturn()).get("matchingId").asText());

        // Revalidation du profil : une nouvelle version de fiche avec contenu → nouvelle identité, de zéro.
        UUID newSheet = seedCandidateSheet(scenario.candidateId(), 2, "3");
        UUID secondMatching = UUID.fromString(json(start(scenario.candidateJwt(), scenario.publicId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"))
                .andReturn()).get("matchingId").asText());
        assertThat(secondMatching).isNotEqualTo(firstMatching);
        assertThat(jdbcTemplate.queryForObject("SELECT candidate_normalized_profile_id FROM matching WHERE id = ?",
                UUID.class, secondMatching)).isEqualTo(newSheet);
        assertThat(count("SELECT count(*) FROM matching WHERE candidate_id = ? AND job_offer_id = ?",
                scenario.candidateId(), scenario.offerId())).isEqualTo(2);
        // Les réponses au recruteur, rattachées à la candidature, sont intactes.
        assertThat(count("SELECT count(*) FROM application WHERE id = ?", scenario.applicationId())).isEqualTo(1);

        // UNIQUE de l'identité (couple + version de fiche).
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO matching (id, candidate_id, job_offer_id, candidate_normalized_profile_id, created_at,
                                      updated_at)
                VALUES (?, ?, ?, ?, now(), now())""", UUID.randomUUID(), scenario.candidateId(), scenario.offerId(),
                newSheet)).isInstanceOf(DataIntegrityViolationException.class);
        UUID offerSheet = jdbcTemplate.queryForObject(
                "SELECT job_offer_normalized_profile_id FROM matching_result WHERE matching_id = ?", UUID.class,
                secondMatching);
        // UNIQUE (matching_id, version) et CHECK version ≥ 1.
        assertThatThrownBy(() -> insertResult(secondMatching, 1, offerSheet))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertResult(secondMatching, 0, offerSheet))
                .isInstanceOf(DataIntegrityViolationException.class);
        // CHECK statut de job 1–4.
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE matching_job SET status = 5 WHERE job_id = ?",
                latestJobId(secondMatching))).isInstanceOf(DataIntegrityViolationException.class);

        // FK composite application.matching_id : le matching d'un autre couple est impossible.
        Scenario other = readyScenario(null);
        UUID otherMatching = UUID.fromString(json(start(other.candidateJwt(), other.publicId()).andReturn())
                .get("matchingId").asText());
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE application SET matching_id = ? WHERE id = ?",
                otherMatching, scenario.applicationId())).isInstanceOf(DataIntegrityViolationException.class);
        jdbcTemplate.update("UPDATE application SET matching_id = ? WHERE id = ?", secondMatching,
                scenario.applicationId());
    }

    @Test
    void preconditionsDuLancementEtDeLaLecture() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), """
                [{"label": "Why?", "type": "text", "isRequired": true, "sortOrder": 0}]""");
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        String candidateJwt = signup();
        UUID candidateId = lastUserId();
        uploadCv(candidateJwt);

        // Sans brouillon, puis brouillon sans l'obligatoire.
        start(candidateJwt, publicId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.REQUIRED_FIRST));
        saveDraft(candidateJwt, publicId, "[]");
        start(candidateJwt, publicId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.REQUIRED_FIRST));
        saveDraft(candidateJwt, publicId, "[{\"questionId\": \"%s\", \"text\": \"Because\"}]"
                .formatted(questionIdOf(offerId, "Why?")));

        // Fiche candidat absente, puis au vieux schéma.
        start(candidateJwt, publicId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.PROFILE_MISSING));
        seedCandidateSheet(candidateId, 1, "2");
        start(candidateJwt, publicId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.PROFILE_OUTDATED));
        seedCandidateSheet(candidateId, 2, "3");

        // Fiche offre sans contenu (analyse non terminée).
        start(candidateJwt, publicId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MatchingService.OFFER_NOT_READY));
        current(candidateJwt, publicId).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No match has been run for this job offer yet."));

        // Offre inconnue, identifiant vide, sans jeton.
        start(candidateJwt, "zzzzzzzzzzzz").andExpect(status().isNotFound());
        mockMvc.perform(post(MATCHINGS_PATH).header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"jobPublicId\": \" \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(MATCHINGS_PATH).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicId + "\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(MATCHINGS_PATH + "/offer/" + publicId)).andExpect(status().isUnauthorized());
        assertThat(count("SELECT count(*) FROM matching WHERE job_offer_id = ?", offerId)).isZero();
    }

    // --- Scénario prêt : offre publiée avec fiche, candidat avec CV, fiche et brouillon complet ---

    private record Scenario(String candidateJwt, UUID candidateId, UUID offerId, String publicId,
            UUID applicationId) {
    }

    private Scenario readyScenario(String questionsJson) throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), questionsJson);
        publish(owner.token(), offerId);
        jdbcTemplate.update("""
                UPDATE normalized_profile SET content = ?::jsonb
                WHERE normalized_profile_id IN (SELECT normalized_profile_id FROM normalized_profile_job_offer
                                                 WHERE job_offer_id = ?)""", OFFER_SHEET, offerId);
        String candidateJwt = signup();
        UUID candidateId = lastUserId();
        uploadCv(candidateJwt);
        seedCandidateSheet(candidateId, 1, "3");
        String publicId = publicIdOf(offerId);
        MvcResult draft = saveDraft(candidateJwt, publicId, "[]");
        return new Scenario(candidateJwt, candidateId, offerId, publicId,
                UUID.fromString(json(draft).get("id").asText()));
    }

    private UUID seedCandidateSheet(UUID candidateId, int version, String schemaVersion) {
        UUID sheetId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO normalized_profile (normalized_profile_id, version, schema_version, content, validated_at,
                                                created_at, updated_at)
                VALUES (?, ?, ?, ?::jsonb, now(), now(), now())""", sheetId, version, schemaVersion, CANDIDATE_SHEET);
        jdbcTemplate.update("INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES (?, ?)",
                sheetId, candidateId);
        return sheetId;
    }

    private void insertResult(UUID matchingId, int version, UUID offerSheet) {
        jdbcTemplate.update("""
                INSERT INTO matching_result (id, matching_id, version, job_offer_normalized_profile_id, created_at)
                VALUES (?, ?, ?, ?, now())""", UUID.randomUUID(), matchingId, version, offerSheet);
    }

    private ResultActions start(String token, String publicId) throws Exception {
        return mockMvc.perform(post(MATCHINGS_PATH)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"jobPublicId\": \"" + publicId + "\"}"));
    }

    private ResultActions current(String token, String publicId) throws Exception {
        return mockMvc.perform(get(MATCHINGS_PATH + "/offer/" + publicId).header("Authorization", "Bearer " + token));
    }

    private MvcResult saveDraft(String token, String publicId, String answersJson) throws Exception {
        return mockMvc.perform(put("/api/v1/applications/draft")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicId + "\", \"answers\": " + answersJson + "}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private UUID latestJobId(UUID matchingId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM matching_result WHERE matching_id = ? ORDER BY version DESC LIMIT 1", UUID.class,
                matchingId);
    }

    private MatchingJobStatus jobStatus(UUID jobId) {
        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT status FROM matching_job WHERE job_id = ?", jobId);
        return MatchingJobStatus.fromCode(((Number) row.get("status")).shortValue());
    }

    private int attempts(UUID jobId) {
        return jdbcTemplate.queryForObject("SELECT attempts FROM matching_job WHERE job_id = ?", Integer.class, jobId);
    }

    private int count(String sql, Object... args) {
        return jdbcTemplate.queryForObject(sql, Integer.class, args);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private UUID questionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("SELECT id FROM job_offer_question WHERE job_offer_id = ? AND label = ?",
                UUID.class, offerId, label);
    }

    private void uploadCv(String token) throws Exception {
        mockMvc.perform(multipart("/api/v1/candidates/me/attachments")
                        .file(new MockMultipartFile("file", "candidate-cv.pdf", "application/pdf",
                                "%PDF-1.4 candidate".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
    }

    private record Owner(String token, UUID companyId) {
    }

    private Owner ownerWithCompany(String companyName) throws Exception {
        String token = signup();
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + companyName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(json(result).get("id").asText());
        createdCompanyIds.add(companyId);
        return new Owner(token, companyId);
    }

    private UUID createOffer(String token, UUID companyId, String questionsArrayJson) throws Exception {
        String questions = questionsArrayJson == null ? "" : ",\n  \"questions\": " + questionsArrayJson;
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "Build and own our platform APIs.",
                                  "seniority": "mid",
                                  "city": "Paris",
                                  "country": "FR",
                                  "contractTypeId": "%s",
                                  "employmentTypeId": "%s",
                                  "workModeId": "%s",
                                  "skills": [{"skillId": "%s", "requirementType": "mandatory", "weight": 4}]%s
                                }
                                """.formatted(companyId, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID, WORK_MODE_ID, SKILL_ID,
                                questions)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(json(result).get("id").asText());
        createdOfferIds.add(offerId);
        return offerId;
    }

    private void publish(String token, UUID offerId) throws Exception {
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String signup() throws Exception {
        String email = "matching-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Ada",
                                  "lastName": "Lovelace",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = json(result);
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }

    private UUID lastUserId() {
        return createdUserIds.get(createdUserIds.size() - 1);
    }

    /** Lance deux appels au même instant (TD-053) et renvoie leurs statuts HTTP. */
    private List<Integer> twoAtOnce(Callable<Integer> call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                calls.add(pool.submit(() -> {
                    go.await();
                    return call.call();
                }));
            }
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : calls) {
                statuses.add(future.get(30, TimeUnit.SECONDS));
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }
}
