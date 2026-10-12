package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Lecture publique d'offre (V15) : sans jeton, une offre PUBLISHED non
 * expirée est lisible par public_id ; le même 404 sûr couvre inconnu, non
 * publié, clôturé et expiré. Le slug suit le titre, le publicId ne bouge
 * jamais.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobPublicIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String LANGUAGE_ID = "b0000000-0000-4000-8000-000000000002";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String WORK_MODE_ID = "b2000000-0000-4000-8000-000000000001";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
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
    void offrePublieeEstLisibleSansJetonEtExposeLesLabels() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID offerId = createOffer(token, "Backend Engineer");
        publish(token, offerId);
        String publicId = publicIdOf(offerId);

        MvcResult result = mockMvc.perform(get("/api/v1/jobs/" + publicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicId").value(publicId))
                .andExpect(jsonPath("$.slug").value("backend-engineer"))
                .andExpect(jsonPath("$.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.companyName").value("Acme"))
                .andExpect(jsonPath("$.seniority").value("mid"))
                .andExpect(jsonPath("$.city").value("Paris"))
                .andExpect(jsonPath("$.contractType").exists())
                .andExpect(jsonPath("$.skills[0].name").value("Java"))
                .andExpect(jsonPath("$.languages[0].name").value("French"))
                .andExpect(jsonPath("$.publishedAt").exists())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.has("recruiterId")).isFalse();
        assertThat(body.has("status")).isFalse();
        assertThat(body.has("hasUnvalidatedChanges")).isFalse();
    }

    @Test
    void offreNonPublieeExpireeOuInconnueRenvoie404() throws Exception {
        String token = ownerWithCompany("Acme");

        UUID draftId = createOffer(token, "Draft Offer");
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(draftId)))
                .andExpect(status().isNotFound());

        UUID validatedId = createOffer(token, "Validated Offer");
        mockMvc.perform(post("/api/v1/job-offers/" + validatedId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(validatedId)))
                .andExpect(status().isNotFound());

        UUID closedId = createOffer(token, "Closed Offer");
        publish(token, closedId);
        mockMvc.perform(post("/api/v1/job-offers/" + closedId + "/close")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(closedId)))
                .andExpect(status().isNotFound());

        UUID expiredId = createOffer(token, "Expired Offer");
        publish(token, expiredId);
        jdbcTemplate.update("UPDATE job_offer SET expires_at = CURRENT_DATE - 1 WHERE id = ?", expiredId);
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(expiredId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/jobs/zzzzzzzzzzzz"))
                .andExpect(status().isNotFound());
    }

    @Test
    void slugSuitLeTitreEtPublicIdResteImmodifiable() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID offerId = createOffer(token, "Backend Engineer");
        String publicId = publicIdOf(offerId);

        // Édition en DRAFT : le slug suit le nouveau titre, le publicId non.
        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": "%s", "title": "Senior Backend Engineer"}
                                """.formatted(companyIdOf(offerId))))
                .andExpect(status().isNoContent());

        assertThat(publicIdOf(offerId)).isEqualTo(publicId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT slug FROM job_offer WHERE id = ?", String.class, offerId))
                .isEqualTo("senior-backend-engineer");

        publish(token, offerId);
        mockMvc.perform(get("/api/v1/jobs/" + publicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("senior-backend-engineer"));
    }

    private String ownerWithCompany(String companyName) throws Exception {
        String token = signup();
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + companyName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);
        return token;
    }

    private UUID createOffer(String token, String title) throws Exception {
        UUID companyId = createdCompanyIds.get(createdCompanyIds.size() - 1);
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "%s",
                                  "description": "Build and own our platform APIs.",
                                  "seniority": "mid",
                                  "city": "Paris",
                                  "country": "FR",
                                  "contractTypeId": "%s",
                                  "employmentTypeId": "%s",
                                  "workModeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ],
                                  "languages": [
                                    {"languageId": "%s", "level": "B2", "isRequired": true}
                                  ]
                                }
                                """.formatted(companyId, title, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID,
                                WORK_MODE_ID, SKILL_ID, LANGUAGE_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdOfferIds.add(offerId);
        return offerId;
    }

    private void publish(String token, UUID offerId) throws Exception {
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private UUID companyIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT company_id FROM job_offer WHERE id = ?", UUID.class, offerId);
    }

    private String signup() throws Exception {
        String email = "public-" + UUID.randomUUID() + "@example.com";
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
