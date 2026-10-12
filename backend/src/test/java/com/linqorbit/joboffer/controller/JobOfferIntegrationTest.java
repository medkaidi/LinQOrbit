package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

import com.jayway.jsonpath.JsonPath;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Parcours offre de bout en bout (D12–D14) : création DRAFT en membre,
 * lecture/listing membre, édition owner/créateur, transitions D13
 * (validate ≠ publish), lecture seule en PUBLISHED/CLOSED, suppression DRAFT
 * seul ; non-membre = 404 (aucune fuite), membre non-gestionnaire = 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobOfferIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String SECOND_SKILL_ID = "a0000000-0000-4000-8000-000000000002";
    private static final String LANGUAGE_ID = "b0000000-0000-4000-8000-000000000002";
    private static final String DEGREE_ID = "c0000000-0000-4000-8000-000000000003";
    private static final String STUDY_FIELD_ID = "d0000000-0000-4000-8000-000000000001";
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
    void cycleDeVieCompletDraftValidationPublicationCloture() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID ownerId = lastUserId();
        UUID companyId = createCompany(ownerToken, "Acme");

        UUID offerId = createOffer(ownerToken, companyId, "Backend Engineer");
        createdOfferIds.add(offerId);

        MvcResult createResult = mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.publicId").isString())
                .andExpect(jsonPath("$.slug").value("backend-engineer"))
                .andExpect(jsonPath("$.skills[0].skillId").value(SKILL_ID))
                .andExpect(jsonPath("$.skills[0].name").value("Java"))
                .andExpect(jsonPath("$.skills[0].requirementType").value("mandatory"))
                .andExpect(jsonPath("$.languages[0].languageId").value(LANGUAGE_ID))
                .andExpect(jsonPath("$.languages[0].symbol").value("fr"))
                .andExpect(jsonPath("$.languages[0].level").value("B2"))
                .andExpect(jsonPath("$.degreeIds[0]").value(DEGREE_ID))
                .andExpect(jsonPath("$.studyFieldIds[0]").value(STUDY_FIELD_ID))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andReturn();
        String publicId = JsonPath.read(createResult.getResponse().getContentAsString(), "$.publicId");

        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, "Senior Backend Engineer", false)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("validated"))
                .andExpect(jsonPath("$.publicId").value(publicId))
                .andExpect(jsonPath("$.slug").value("senior-backend-engineer"))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andExpect(jsonPath("$.validatedAt").exists());

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, "Staff Backend Engineer", false)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(true));

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("published"))
                .andExpect(jsonPath("$.publishedAt").exists())
                // publish pose updatedAt après validatedAt : le dirty-flag ne doit
                // pas basculer sur un statut lecture seule (D13).
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false));

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, "Hijacked", false)))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/close")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("closed"))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM job_offer WHERE id = ?", Short.class, offerId))
                .isEqualTo((short) 4);
        assertThat(ownerId).isNotNull();
    }

    @Test
    void transitionsInvalidesRenvoient409EtSuppressionReserveeAuDraft() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID companyId = createCompany(ownerToken, "Acme");

        UUID offerId = createOffer(ownerToken, companyId, "Backend Engineer");
        createdOfferIds.add(offerId);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/close")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isConflict());

        UUID draftId = createOffer(ownerToken, companyId, "Frontend Engineer");
        createdOfferIds.add(draftId);
        mockMvc.perform(delete("/api/v1/job-offers/" + draftId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM job_offer WHERE id = ?",
                Long.class, draftId)).isZero();
    }

    @Test
    void permissionsMembreEtNonMembre() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID companyId = createCompany(ownerToken, "Acme");
        UUID offerId = createOffer(ownerToken, companyId, "Backend Engineer");
        createdOfferIds.add(offerId);

        String strangerToken = signup("stranger");
        becomeRecruiter(strangerToken);
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        String memberToken = signup("member");
        becomeRecruiter(memberToken);
        UUID memberId = lastUserId();
        jdbcTemplate.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, false)",
                companyId, memberId);

        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(offerId.toString()));

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, "Hijacked", false)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isForbidden());

        UUID memberOfferId = createOffer(memberToken, companyId, "Member Offer");
        createdOfferIds.add(memberOfferId);
        mockMvc.perform(put("/api/v1/job-offers/" + memberOfferId)
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, "Owner Edit", false)))
                .andExpect(status().isNoContent());
    }

    @Test
    void creationRejetteUneReferenceInconnueEtUnNonMembre() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID companyId = createCompany(ownerToken, "Acme");

        mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "Build APIs.",
                                  "country": "FR",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "ffffffff-ffff-4fff-8fff-ffffffffffff", "requirementType": "mandatory", "weight": 3}
                                  ]
                                }
                                """.formatted(companyId, EMPLOYMENT_TYPE_ID)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(
                        "Unknown skill: ffffffff-ffff-4fff-8fff-ffffffffffff"));

        String strangerToken = signup("stranger");
        becomeRecruiter(strangerToken);
        mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + strangerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "Build APIs.",
                                  "country": "FR",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 3}
                                  ]
                                }
                                """.formatted(companyId, EMPLOYMENT_TYPE_ID, SKILL_ID)))
                .andExpect(status().isNotFound());
    }

    @Test
    void creationAvecDoublonsDeCompetencesEtLanguesRecoit201EtDedupe() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID companyId = createCompany(ownerToken, "Acme");

        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "Build APIs.",
                                  "country": "FR",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4},
                                    {"skillId": "%s", "requirementType": "preferred", "weight": 2}
                                  ],
                                  "languages": [
                                    {"languageId": "%s", "level": "B2", "isRequired": true},
                                    {"languageId": "%s", "level": "A2", "isRequired": false}
                                  ]
                                }
                                """.formatted(companyId, EMPLOYMENT_TYPE_ID, SKILL_ID, SKILL_ID, LANGUAGE_ID,
                                LANGUAGE_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdOfferIds.add(offerId);

        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skills.length()").value(1))
                .andExpect(jsonPath("$.skills[0].skillId").value(SKILL_ID))
                .andExpect(jsonPath("$.languages.length()").value(1))
                .andExpect(jsonPath("$.languages[0].languageId").value(LANGUAGE_ID));
    }

    @Test
    void duplicationCopieLeContenuEnDraftEt404PourUnNonMembre() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        UUID companyId = createCompany(ownerToken, "Acme");

        UUID offerId = createOffer(ownerToken, companyId, "Backend Engineer");
        createdOfferIds.add(offerId);
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isNoContent());

        MvcResult duplicateResult = mockMvc
                .perform(post("/api/v1/job-offers/" + offerId + "/duplicate")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.companyId").value(companyId.toString()))
                .andExpect(jsonPath("$.title").value("Backend Engineer (copy)"))
                .andExpect(jsonPath("$.slug").value("backend-engineer-copy"))
                .andExpect(jsonPath("$.skills.length()").value(2))
                .andExpect(jsonPath("$.skills[0].skillId").value(SKILL_ID))
                .andExpect(jsonPath("$.languages[0].languageId").value(LANGUAGE_ID))
                .andExpect(jsonPath("$.degreeIds[0]").value(DEGREE_ID))
                .andExpect(jsonPath("$.studyFieldIds[0]").value(STUDY_FIELD_ID))
                .andReturn();
        JsonNode copy = objectMapper.readTree(duplicateResult.getResponse().getContentAsString());
        UUID copyId = UUID.fromString(copy.get("id").asText());
        createdOfferIds.add(copyId);
        assertThat(copyId).isNotEqualTo(offerId);
        assertThat(copy.get("publicId").asText()).isNotEmpty();
        assertThat(copy.get("validatedAt").isNull()).isTrue();
        assertThat(copy.get("publishedAt").isNull()).isTrue();
        assertThat(copy.get("expiresAt").isNull()).isTrue();

        mockMvc.perform(get("/api/v1/job-offers/" + copyId).header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false));

        String strangerToken = signup("stranger");
        becomeRecruiter(strangerToken);
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/duplicate")
                        .header("Authorization", "Bearer " + strangerToken))
                .andExpect(status().isNotFound());
    }

    private UUID createOffer(String token, UUID companyId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(offerBody(companyId, title, true)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("draft"))
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }
    private String offerBody(UUID companyId, String title, boolean withReferences) {
        if (!withReferences) {
            return """
                    {
                      "companyId": "%s",
                      "title": "%s",
                      "description": "Build and own our platform APIs.",
                      "city": "Paris",
                      "country": "FR",
                      "employmentTypeId": "%s",
                      "skills": [
                        {"skillId": "%s", "requirementType": "mandatory", "weight": 3}
                      ]
                    }
                    """.formatted(companyId, title, EMPLOYMENT_TYPE_ID, SKILL_ID);
        }
        return """
                {
                  "companyId": "%s",
                  "title": "%s",
                  "description": "Build and own our platform APIs.",
                  "seniority": "mid",
                  "requiredExpYear": 3,
                  "city": "Paris",
                  "country": "FR",
                  "contractTypeId": "%s",
                  "employmentTypeId": "%s",
                  "workModeId": "%s",
                  "salaryMin": 50000,
                  "salaryMax": 70000,
                  "salaryCurrency": "EUR",
                  "salaryPeriod": "year",
                  "skills": [
                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4, "yearsExperience": 2},
                    {"skillId": "%s", "requirementType": "preferred", "weight": 2}
                  ],
                  "languages": [
                    {"languageId": "%s", "level": "B2", "isRequired": true}
                  ],
                  "degreeIds": ["%s"],
                  "studyFieldIds": ["%s"]
                }
                """.formatted(companyId, title, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID, WORK_MODE_ID,
                SKILL_ID, SECOND_SKILL_ID, LANGUAGE_ID, DEGREE_ID, STUDY_FIELD_ID);
    }

    private UUID createCompany(String token, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + name + "\"}"))
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

    private UUID lastUserId() {
        return createdUserIds.get(createdUserIds.size() - 1);
    }

    private String signup(String prefix) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@example.com";
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
