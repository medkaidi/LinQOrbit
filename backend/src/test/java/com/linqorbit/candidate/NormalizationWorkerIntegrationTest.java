package com.linqorbit.candidate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.linqorbit.candidate.exception.AiServiceException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Worker de normalisation contre PostgreSQL : le polling planifié est garé par
 * application.properties (test) — les tests appellent poll() manuellement et
 * remplacent le client IA par un mock.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NormalizationWorkerIntegrationTest {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";
    private static final String CANONICAL_JSON =
            "{\"schemaVersion\": \"1\", \"title\": \"Full Stack Developer\", \"experiences\": []}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private NormalizationWorker normalizationWorker;
    @Autowired
    private Environment environment;

    @MockitoBean
    private ProfileNormalizeClient profileNormalizeClient;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final java.util.Map<UUID, String> tokens = new java.util.HashMap<>();

    @BeforeEach
    void parkPollerAndSucceedByDefault() {
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
                                      WHERE npc.normalized_profile_id = np.normalized_profile_id)""");
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
        tokens.clear();
    }

    @Test
    void lePollerPlanifieEstGareDansLesTests() {
        assertThat(environment.getProperty("app.normalization.initial-delay-ms")).isEqualTo("3600000");
        assertThat(environment.getProperty("app.normalization.poll-interval-ms")).isEqualTo("3600000");
    }

    @Test
    void executionReussieEcritLeContenuEtMarqueLeJobDone() throws Exception {
        UUID userId = validatedCandidate();

        normalizationWorker.poll();

        Map<String, Object> row = jobRow(userId, 1);
        assertThat(row.get("status")).isEqualTo("DONE");
        assertThat(row.get("completed_at")).isNotNull();
        assertThat(String.valueOf(row.get("content"))).contains("\"schemaVersion\": \"1\"");
    }

    @Test
    void echecIaPlanifieUneTentativePuisAbandonneApresTrois() throws Exception {
        UUID userId = validatedCandidate();
        when(profileNormalizeClient.normalize(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."));

        normalizationWorker.poll();
        Map<String, Object> first = jobRow(userId, 1);
        assertThat(first.get("status")).isEqualTo("PENDING");
        assertThat((Integer) first.get("attempts")).isEqualTo(1);
        assertThat(first.get("error")).isEqualTo("The AI service call failed.");
        assertThat(nextAttemptIsInFuture(userId, 1)).isTrue();

        normalizationWorker.poll();
        assertThat((Integer) jobRow(userId, 1).get("attempts")).isEqualTo(1);

        forceDue(userId, 1);
        normalizationWorker.poll();
        assertThat((Integer) jobRow(userId, 1).get("attempts")).isEqualTo(2);

        forceDue(userId, 1);
        normalizationWorker.poll();
        Map<String, Object> abandoned = jobRow(userId, 1);
        assertThat(abandoned.get("status")).isEqualTo("FAILED");
        assertThat((Integer) abandoned.get("attempts")).isEqualTo(3);
        assertThat(abandoned.get("completed_at")).isNotNull();

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + tokenOf(userId))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());
        assertThat(profileCount(userId)).isEqualTo(2);
    }

    @Test
    void recupereUnRunningPerimeEtReexecute() throws Exception {
        UUID userId = validatedCandidate();
        jdbcTemplate.update("""
                UPDATE normalization_job SET status = 'RUNNING', started_at = ?
                WHERE job_id = (SELECT np.normalized_profile_id FROM normalized_profile np
                                JOIN normalized_profile_candidate npc
                                    ON npc.normalized_profile_id = np.normalized_profile_id
                                WHERE npc.candidate_id = ? AND np.version = 1)""",
                LocalDateTime.now().minusMinutes(11), userId);

        normalizationWorker.poll();

        Map<String, Object> recovered = jobRow(userId, 1);
        assertThat(recovered.get("status")).isEqualTo("PENDING");
        assertThat((Integer) recovered.get("attempts")).isEqualTo(1);
        assertThat(recovered.get("error")).isEqualTo("Worker presumed dead before completion");

        forceDue(userId, 1);
        normalizationWorker.poll();
        assertThat(jobRow(userId, 1).get("status")).isEqualTo("DONE");
    }

    private UUID validatedCandidate() throws Exception {
        String token = signup();
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
        return createdUserIds.get(createdUserIds.size() - 1);
    }

    private String tokenOf(UUID userId) {
        return tokens.get(userId);
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

    private void forceDue(UUID userId, int version) {
        jdbcTemplate.update("""
                UPDATE normalization_job SET next_attempt_at = ?
                WHERE job_id = (SELECT np.normalized_profile_id FROM normalized_profile np
                                JOIN normalized_profile_candidate npc
                                    ON npc.normalized_profile_id = np.normalized_profile_id
                                WHERE npc.candidate_id = ? AND np.version = ?)""",
                LocalDateTime.now().minusSeconds(1), userId, version);
    }

    private boolean nextAttemptIsInFuture(UUID userId, int version) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject("""
                SELECT next_attempt_at > now()
                FROM normalization_job
                WHERE job_id = (SELECT np.normalized_profile_id FROM normalized_profile np
                                JOIN normalized_profile_candidate npc
                                    ON npc.normalized_profile_id = np.normalized_profile_id
                                WHERE npc.candidate_id = ? AND np.version = ?)""",
                Boolean.class, userId, version));
    }

    private Map<String, Object> jobRow(UUID userId, int version) {
        return jdbcTemplate.queryForMap("""
                SELECT j.status, j.attempts, j.next_attempt_at, j.error, j.completed_at, np.content
                FROM normalization_job j
                JOIN normalized_profile_candidate npc
                    ON npc.normalized_profile_id = j.job_id
                JOIN normalized_profile np
                    ON np.normalized_profile_id = npc.normalized_profile_id
                WHERE npc.candidate_id = ? AND np.version = ?""", userId, version);
    }

    private int profileCount(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FROM normalized_profile np
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?""", Integer.class, userId);
    }
}
