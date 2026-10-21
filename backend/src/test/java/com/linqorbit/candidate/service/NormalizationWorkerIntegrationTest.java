package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.exception.AiServiceException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.linqorbit.candidate.client.ProfileNormalizeClient;

/**
 * Worker de normalisation contre PostgreSQL : le déclenchement est un push
 * (événement après commit → exécuteur), pas un poller. Les tests appellent
 * {@code executeJob()} / {@code recoverOrphanJobs()} manuellement et
 * remplacent exécuteur, scheduler et client IA par des mocks déterministes.
 * Les jobs sont amorcés en SQL (pas via l'endpoint de validation) pour ne
 * jamais déclencher de dispatch asynchrone réel.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NormalizationWorkerIntegrationTest {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";
    private static final String CANONICAL_JSON =
            "{\"schemaVersion\": \"3\", \"title\": \"Full Stack Developer\", \"experiences\": []}";
    private static final String STALE_ERROR = "Worker presumed dead before completion";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private NormalizationWorker normalizationWorker;

    @MockitoBean
    private ProfileNormalizeClient profileNormalizeClient;
    @MockitoBean(name = "normalizationExecutor")
    private ThreadPoolTaskExecutor normalizationExecutor;
    @MockitoBean(name = "normalizationTaskScheduler")
    private TaskScheduler normalizationTaskScheduler;

    private final ArgumentCaptor<Runnable> dispatchCaptor = ArgumentCaptor.forClass(Runnable.class);
    private final ArgumentCaptor<Runnable> scheduleCaptor = ArgumentCaptor.forClass(Runnable.class);
    private final ArgumentCaptor<Instant> scheduleInstantCaptor = ArgumentCaptor.forClass(Instant.class);

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final java.util.Map<UUID, String> tokens = new java.util.HashMap<>();

    @BeforeEach
    void succeedByDefault() {
        // Le recovery au démarrage peut avoir consommé un job PENDING laissé par
        // une exécution précédente : ces appels ne doivent pas polluer les
        // vérifications du test courant.
        clearInvocations(normalizationExecutor, normalizationTaskScheduler, profileNormalizeClient);
        when(profileNormalizeClient.normalize(any())).thenReturn(CANONICAL_JSON);
    }

    @AfterEach
    void cleanup() {
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_candidate npc
                    WHERE npc.normalized_profile_id = j.job_id AND npc.candidate_id = ?""", userId);
            jdbcTemplate.update(
                    "DELETE FROM normalized_profile_candidate WHERE candidate_id = ?", userId);
            jdbcTemplate.update("""
                    DELETE FROM normalized_profile np
                    WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                      WHERE npc.normalized_profile_id = np.normalized_profile_id)
                      AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                      WHERE npo.normalized_profile_id = np.normalized_profile_id)""");
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
        tokens.clear();
    }

    @Test
    void executionReussieEcritLeContenuEtMarqueLeJobDone() throws Exception {
        UUID jobId = seedValidatedCandidate();

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jobRowWithContent(jobId);
        assertThat(statusOf(row)).isEqualTo(NormalizationJobStatus.DONE);
        assertThat(row.get("completed_at")).isNotNull();
        assertThat(String.valueOf(row.get("content"))).contains("\"schemaVersion\": \"3\"");
    }

    @Test
    void echecIaReplanifieDeuxRetriesPuisAbandonneSansQuatriemeTentative() throws Exception {
        UUID jobId = seedValidatedCandidate();
        // La validation HTTP a déjà soumis le job au pool (mock inert) : on ne
        // gère ici que les soumissions des retries.
        clearInvocations(normalizationExecutor);
        when(profileNormalizeClient.normalize(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."));

        normalizationWorker.executeJob(jobId);
        Map<String, Object> first = jobRow(jobId);
        assertThat(statusOf(first)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat((Integer) first.get("attempts")).isEqualTo(1);
        assertThat(first.get("error")).isEqualTo("The AI service call failed.");
        assertThat(nextAttemptIsInFuture(jobId)).isTrue();
        runScheduledToCompletion();

        Map<String, Object> second = jobRow(jobId);
        assertThat(statusOf(second)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat((Integer) second.get("attempts")).isEqualTo(2);
        runScheduledToCompletion();

        Map<String, Object> abandoned = jobRow(jobId);
        assertThat(statusOf(abandoned)).isEqualTo(NormalizationJobStatus.FAILED);
        assertThat((Integer) abandoned.get("attempts")).isEqualTo(3);
        assertThat(abandoned.get("completed_at")).isNotNull();

        normalizationWorker.executeJob(jobId);
        assertThat((Integer) jobRow(jobId).get("attempts")).isEqualTo(3);
        assertThat(statusOf(jobRow(jobId))).isEqualTo(NormalizationJobStatus.FAILED);
        verify(profileNormalizeClient, times(3)).normalize(any());
    }

    @Test
    void jobSupersedeNeJamaisExecute() throws Exception {
        UUID jobId = seedValidatedCandidate();
        // Statut SMALLINT : 5 = SUPERSEDED.
        jdbcTemplate.update("UPDATE normalization_job SET status = 5 WHERE job_id = ?", jobId);

        normalizationWorker.executeJob(jobId);

        assertThat(statusOf(jobRow(jobId))).isEqualTo(NormalizationJobStatus.SUPERSEDED);
        assertThat((Integer) jobRow(jobId).get("attempts")).isZero();
        verify(profileNormalizeClient, never()).normalize(any());
    }

    @Test
    void recupereUnRunningPerimeEtReplanifie() throws Exception {
        UUID jobId = seedValidatedCandidate();
        // La validation HTTP a déjà soumis le job au pool (mock inert) : on ne
        // gère ici que la soumission du retry.
        clearInvocations(normalizationExecutor);
        // Statut SMALLINT : 2 = RUNNING.
        jdbcTemplate.update("UPDATE normalization_job SET status = 2, started_at = ? WHERE job_id = ?",
                LocalDateTime.now().minusMinutes(11), jobId);

        normalizationWorker.recoverOrphanJobs();

        Map<String, Object> recovered = jobRow(jobId);
        assertThat(statusOf(recovered)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat((Integer) recovered.get("attempts")).isEqualTo(1);
        assertThat(recovered.get("error")).isEqualTo(STALE_ERROR);
        runScheduledToCompletion();
        assertThat(statusOf(jobRow(jobId))).isEqualTo(NormalizationJobStatus.DONE);
    }

    @Test
    void recoveryAuBootExecuteLesDusEtPlanifieLesFutursASonEcheance() throws Exception {
        String token = signup();
        // L'écriture about crée la ligne candidates ; aucun validate HTTP donc
        // aucun dispatch réel avant recoverOrphanJobs — sinon le due job serait
        // soumis deux fois.
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full Stack Developer", "bio": "Profil de test",
                                 "yearsOfExperience": 6, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        UUID dueJobId = seedJob(userId, 1, NormalizationJobStatus.PENDING, 0, LocalDateTime.now().minusSeconds(1), null);
        UUID futureJobId = seedJob(userId, 2, NormalizationJobStatus.PENDING, 1, LocalDateTime.now().plusMinutes(30), null);
        Instant scheduledAt = Instant.now();

        normalizationWorker.recoverOrphanJobs();

        takeDispatched().run();
        assertThat(statusOf(jobRow(dueJobId))).isEqualTo(NormalizationJobStatus.DONE);

        verify(normalizationTaskScheduler).schedule(scheduleCaptor.capture(), scheduleInstantCaptor.capture());
        clearInvocations(normalizationTaskScheduler);
        assertThat(scheduleInstantCaptor.getValue())
                .isAfterOrEqualTo(scheduledAt.plusSeconds(29 * 60))
                .isBeforeOrEqualTo(scheduledAt.plusSeconds(31 * 60));
        scheduleCaptor.getValue().run();
        takeDispatched().run();
        assertThat(statusOf(jobRow(futureJobId))).isEqualTo(NormalizationJobStatus.DONE);
    }

    @Test
    void soumissionExecuteurRejeteePlanifieUneReSoumission() throws Exception {
        UUID jobId = seedValidatedCandidate();
        // 1re soumission rejetée (queue saturée) ; la re-soumission planifiée réussit.
        doThrow(new RejectedExecutionException("queue saturée"))
                .doAnswer(invocation -> {
                    ((Runnable) invocation.getArgument(0)).run();
                    return null;
                })
                .when(normalizationExecutor).execute(any(Runnable.class));

        normalizationWorker.onProfileValidated(new ProfileValidatedEvent(jobId));

        takeScheduled().run();
        assertThat(statusOf(jobRow(jobId))).isEqualTo(NormalizationJobStatus.DONE);
    }

    @Test
    void validationHttpDeclencheLExecutionApresCommit() throws Exception {
        String token = signup();
        seedAboutAndValidate(token);
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        UUID jobId = latestJobId(userId);

        takeDispatched().run();

        assertThat(statusOf(jobRow(jobId))).isEqualTo(NormalizationJobStatus.DONE);
    }

    // --- D63 : garde du schemaVersion avant toute écriture de content --------

    @Test
    void jsonIaSansSchemaVersionEstUnEchecSansEcritureDeContenu() throws Exception {
        assertJsonIaRejeteSansEcriture("{\"title\": \"Full Stack Developer\", \"experiences\": []}",
                "The AI service returned schemaVersion null, expected 3.");
    }

    @Test
    void jsonIaALaVersionOffreEstRefusePourUnCandidatSansEcriture() throws Exception {
        // Les versions candidat et offre ne se comparent jamais entre elles : "2" n'est pas "3".
        assertJsonIaRejeteSansEcriture("{\"schemaVersion\": \"2\", \"title\": \"Full Stack Developer\"}",
                "The AI service returned schemaVersion 2, expected 3.");
    }

    @Test
    void jsonIaAvecUnSchemaVersionNonTexteEstRefuse() throws Exception {
        assertJsonIaRejeteSansEcriture("{\"schemaVersion\": 3, \"title\": \"Full Stack Developer\"}",
                "The AI service returned schemaVersion null, expected 3.");
    }

    @Test
    void jsonIaIllisibleEstUnEchecSansEcritureDeContenu() throws Exception {
        assertJsonIaRejeteSansEcriture("not json",
                "The AI service returned schemaVersion null, expected 3.");
    }

    @Test
    void jsonIaDeMauvaiseVersionRetenteDeuxFoisPuisFailedSansJamaisEcrire() throws Exception {
        UUID jobId = seedValidatedCandidate();
        clearInvocations(normalizationExecutor);
        when(profileNormalizeClient.normalize(any())).thenReturn("{\"schemaVersion\": \"1\"}");

        normalizationWorker.executeJob(jobId);
        runScheduledToCompletion();
        runScheduledToCompletion();

        Map<String, Object> row = jobRowWithContent(jobId);
        assertThat(statusOf(row)).isEqualTo(NormalizationJobStatus.FAILED);
        assertThat((Integer) row.get("attempts")).isEqualTo(3);
        assertThat(row.get("content")).isNull();
        verify(profileNormalizeClient, times(3)).normalize(any());
    }

    @Test
    void ligneValideeSousUneAutreVersionNAppelleJamaisLIa() throws Exception {
        String token = signup();
        seedAboutAndValidate(token);
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        // Job validé avant une montée de version : sa ligne annonce encore « 2 ».
        UUID jobId = seedJob(userId, 2, NormalizationJobStatus.PENDING, 0, LocalDateTime.now(), null);
        jdbcTemplate.update("UPDATE normalized_profile SET schema_version = '2' WHERE normalized_profile_id = ?",
                jobId);
        clearInvocations(profileNormalizeClient);

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jobRowWithContent(jobId);
        assertThat(statusOf(row)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat((Integer) row.get("attempts")).isEqualTo(1);
        assertThat(row.get("content")).isNull();
        verify(profileNormalizeClient, never()).normalize(any());
    }

    private void assertJsonIaRejeteSansEcriture(String canonical, String expectedError) throws Exception {
        UUID jobId = seedValidatedCandidate();
        when(profileNormalizeClient.normalize(any())).thenReturn(canonical);

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jobRowWithContent(jobId);
        assertThat(statusOf(row)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat((Integer) row.get("attempts")).isEqualTo(1);
        assertThat(row.get("error")).isEqualTo(expectedError);
        assertThat(row.get("content")).isNull();
        assertThat(row.get("completed_at")).isNull();
    }

    private Runnable takeDispatched() {
        verify(normalizationExecutor).execute(dispatchCaptor.capture());
        clearInvocations(normalizationExecutor);
        return dispatchCaptor.getValue();
    }

    /** Le runnable planifié ne soumet qu'au pool : il faut encore lancer la soumission capturée. */
    private void runScheduledToCompletion() {
        takeScheduled().run();
        takeDispatched().run();
    }

    private Runnable takeScheduled() {
        verify(normalizationTaskScheduler).schedule(scheduleCaptor.capture(), scheduleInstantCaptor.capture());
        clearInvocations(normalizationTaskScheduler);
        return scheduleCaptor.getValue();
    }

    private UUID seedValidatedCandidate() throws Exception {
        String token = signup();
        seedAboutAndValidate(token);
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        return latestJobId(userId);
    }

    /** Amorce un job en SQL : aucun événement, aucun dispatch asynchrone. */
    private UUID seedJob(UUID userId, int version, NormalizationJobStatus status, int attempts,
            LocalDateTime nextAttemptAt, LocalDateTime startedAt) {
        UUID jobId = UUID.randomUUID();
        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update("""
                INSERT INTO normalized_profile
                    (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at)
                VALUES (?, ?, '3', NULL, ?, ?, ?)""", jobId, version, now, now, now);
        jdbcTemplate.update(
                "INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES (?, ?)",
                jobId, userId);
        jdbcTemplate.update("""
                INSERT INTO normalization_job
                    (job_id, status, source_type, attempts, next_attempt_at, error, created_at, started_at)
                VALUES (?, ?, 1, ?, ?, NULL, ?, ?)""",
                jobId, status.getCode(), attempts, nextAttemptAt, now, startedAt);
        return jobId;
    }

    private void seedAboutAndValidate(String token) throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full Stack Developer", "bio": "Profil de test",
                                 "yearsOfExperience": 6, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String signup() throws Exception {
        String email = "worker-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
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
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID userId = UUID.fromString(body.get("user").get("id").asText());
        createdUserIds.add(userId);
        String token = body.get("token").asText();
        tokens.put(userId, token);
        return token;
    }

    private UUID latestJobId(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT np.normalized_profile_id FROM normalized_profile np
                JOIN normalized_profile_candidate npc ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?
                ORDER BY np.version DESC LIMIT 1""", UUID.class, userId);
    }

    private boolean nextAttemptIsInFuture(UUID jobId) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT next_attempt_at > now() FROM normalization_job WHERE job_id = ?",
                Boolean.class, jobId));
    }

    private Map<String, Object> jobRow(UUID jobId) {
        return jdbcTemplate.queryForMap(
                "SELECT status, attempts, next_attempt_at, error, completed_at FROM normalization_job WHERE job_id = ?",
                jobId);
    }

    /** Statut SMALLINT → enum (les assertions parlent métier, pas codes). */
    private static NormalizationJobStatus statusOf(Map<String, Object> row) {
        return NormalizationJobStatus.fromCode(((Number) row.get("status")).shortValue());
    }

    private Map<String, Object> jobRowWithContent(UUID jobId) {
        return jdbcTemplate.queryForMap("""
                SELECT j.status, j.attempts, j.error, j.completed_at, np.content
                FROM normalization_job j
                JOIN normalized_profile np ON np.normalized_profile_id = j.job_id
                WHERE j.job_id = ?""", jobId);
    }
}
