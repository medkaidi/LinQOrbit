package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.joboffer.client.JobOfferNormalizeClient;
import com.linqorbit.joboffer.dto.OfferNormalizeRequest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Branche offre du worker unique contre PostgreSQL : validate → job OFFER →
 * exécution synchrone (client IA mocké) → contenu écrit + DONE. L'exécuteur
 * est remplacé par un mock inerte : aucun dispatch asynchrone réel, les
 * appels à {@code executeJob()} sont manuels et déterministes.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NormalizationWorkerOfferIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String CANONICAL_OFFER_JSON =
            "{\"schemaVersion\": \"1\", \"title\": \"Backend Engineer\","
                    + " \"requiredSkills\": [], \"preferredSkills\": []}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private NormalizationWorker normalizationWorker;

    @MockitoBean
    private JobOfferNormalizeClient jobOfferNormalizeClient;
    @MockitoBean(name = "normalizationExecutor")
    private ThreadPoolTaskExecutor normalizationExecutor;
    @MockitoBean(name = "normalizationTaskScheduler")
    private TaskScheduler normalizationTaskScheduler;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_job_offer npo
                    WHERE npo.normalized_profile_id = j.job_id AND npo.job_offer_id = ?""", offerId);
            jdbcTemplate.update("DELETE FROM normalized_profile_job_offer WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM normalized_profile np
                    WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                       WHERE npc.normalized_profile_id = np.normalized_profile_id)
                      AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                       WHERE npo.normalized_profile_id = np.normalized_profile_id)""");
            jdbcTemplate.update("DELETE FROM job_offer_skill WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_language WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_degree WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_study_field WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        for (UUID companyId : createdCompanyIds) {
            jdbcTemplate.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        createdOfferIds.clear();
        createdUserIds.clear();
        createdCompanyIds.clear();
    }

    @Test
    void validateCreeUnJobOfferPuisExecuteEcritLeContenuEtMarqueDone() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        createdOfferIds.add(offerId);
        ArgumentCaptor<OfferNormalizeRequest> requestCaptor =
                ArgumentCaptor.forClass(OfferNormalizeRequest.class);
        when(jobOfferNormalizeClient.normalize(requestCaptor.capture()))
                .thenReturn(CANONICAL_OFFER_JSON);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        UUID jobId = latestOfferJobId(offerId);
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("validated"))
                .andExpect(jsonPath("$.normalizationInProgress").value(true))
                .andExpect(jsonPath("$.normalizationFailed").value(false));

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT j.status, j.source_type, np.content FROM normalization_job j"
                        + " JOIN normalized_profile np ON np.normalized_profile_id = j.job_id"
                        + " WHERE j.job_id = ?", jobId);
        assertThat(NormalizationJobStatus.fromCode(((Number) row.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.DONE);
        // Enum SMALLINT : 2 = OFFER (le worker a branché sur source_type).
        assertThat(((Number) row.get("source_type")).intValue()).isEqualTo(2);
        assertThat(String.valueOf(row.get("content"))).contains("\"schemaVersion\": \"1\"");

        OfferNormalizeRequest sent = requestCaptor.getValue();
        assertThat(sent.offer().title()).isEqualTo("Backend Engineer");
        // Description HTML strippée avant l'envoi au LLM.
        assertThat(sent.offer().description()).isEqualTo("Own the public API.");
        assertThat(sent.offer().contractTypeLabel()).isEqualTo("Permanent");
        assertThat(sent.offer().company().description()).isEqualTo("We build payments.");
        assertThat(sent.offer().skills()).hasSize(1);
        assertThat(sent.offer().skills().get(0).requirementType()).isEqualTo("mandatory");

        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationInProgress").value(false))
                .andExpect(jsonPath("$.normalizationFailed").value(false));
        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].normalizationInProgress").value(false));
    }

    @Test
    void doubleValidateNeCreePasDeuxVersions() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        createdOfferIds.add(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        // L'exécuteur est inerte : le job reste PENDING, le second validate
        // doit retomber sur le no-op (aucune seconde version).
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        Integer versions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM normalized_profile_job_offer WHERE job_offer_id = ?",
                Integer.class, offerId);
        assertThat(versions).isEqualTo(1);
    }

    private UUID latestOfferJobId(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT j.job_id FROM normalization_job j"
                        + " JOIN normalized_profile_job_offer npo ON npo.normalized_profile_id = j.job_id"
                        + " WHERE npo.job_offer_id = ?", UUID.class, offerId);
    }

    private UUID createOffer(String token, UUID companyId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "<p>Own the <strong>public API</strong>.</p>",
                                  "city": "Paris",
                                  "country": "FR",
                                  "contractTypeId": "%s",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ]
                                }
                                """.formatted(companyId, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID, SKILL_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
    }

    private UUID createCompany(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\", \"description\": \"We build payments.\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);
        return companyId;
    }

    private void becomeRecruiter(String token) throws Exception {
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
    }

    private String signup() throws Exception {
        String email = "offer-worker-" + UUID.randomUUID() + "@example.com";
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
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }
}
