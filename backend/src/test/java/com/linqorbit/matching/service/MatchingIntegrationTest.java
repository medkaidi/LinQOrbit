package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
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
import com.linqorbit.matching.dto.MatchingAnalyzeRequest;
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
              {"criterionKey": "skill:react", "score": 40, "rationale": "Adjacent.", "evidence": []},
              {"criterionKey": "language:english", "score": 100, "rationale": "C2.", "evidence": []},
              {"criterionKey": "experience:total", "score": 100, "rationale": "5 relevant years.", "evidence": []}
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
    @MockitoBean(name = "matchingExecutor")
    private ThreadPoolTaskExecutor matchingExecutor;
    @MockitoBean(name = "matchingTaskScheduler")
    private TaskScheduler matchingTaskScheduler;
    @MockitoSpyBean
    private MatchingStatusBroadcaster matchingStatusBroadcaster;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            jdbcTemplate.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
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
                  {"criterionKey": "skill:java", "score": 90, "rationale": "r"}]}""").when(matchingAnalyzeClient).analyze(any());
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
}
