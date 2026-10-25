package com.linqorbit.joboffer.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Socle des tests d'intégration de la recherche d'offres (T-70 liste recruteur,
 * T-77 job board), sur PostgreSQL réel. Les offres sont créées par l'API puis
 * <b>configurées en base</b> (statut, vocabulaires, dates) : le cycle de vie
 * complet (validation, normalisation) n'est pas l'objet de ces tests. Le worker
 * de normalisation est mocké (aucun dispatch vers l'IA). Base de dev partagée :
 * chaque test ne nettoie que ce qu'il a créé et scope ses assertions par des
 * titres à jeton unique.
 */
abstract class JobOfferSearchTestSupport {

    protected static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    protected static final UUID REMOTE = UUID.fromString("b2000000-0000-4000-8000-000000000001");
    protected static final UUID HYBRID = UUID.fromString("b2000000-0000-4000-8000-000000000002");
    protected static final UUID ON_SITE = UUID.fromString("b2000000-0000-4000-8000-000000000003");
    protected static final UUID PERMANENT = UUID.fromString("b0000000-0000-4000-8000-000000000001");
    protected static final UUID FIXED_TERM = UUID.fromString("b0000000-0000-4000-8000-000000000002");
    protected static final UUID FULL_TIME = UUID.fromString("b1000000-0000-4000-8000-000000000001");
    protected static final UUID PART_TIME = UUID.fromString("b1000000-0000-4000-8000-000000000002");

    protected static final int DRAFT = 1;
    protected static final int VALIDATED = 2;
    protected static final int PUBLISHED = 3;
    protected static final int CLOSED = 4;

    protected static final int JUNIOR = 1;
    protected static final int MID = 2;
    protected static final int SENIOR = 3;
    protected static final int LEAD = 4;

    @Autowired
    protected MockMvc mockMvc;
    @Autowired
    protected ObjectMapper objectMapper;
    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @MockitoBean
    private NormalizationWorker normalizationWorker;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    /** Un recruteur (jeton) et sa première société. */
    protected record Owner(String token, UUID companyId) {
    }

    /** Valeurs de base d'une offre de test ; chaque méthode renvoie {@code this}. */
    protected static final class Spec {
        int status = PUBLISHED;
        Integer seniority = MID;
        UUID workMode = REMOTE;
        UUID contract = PERMANENT;
        UUID employment = FULL_TIME;
        String country = "FR";
        LocalDate expiresAt;
        int ageSeconds = 60;

        static Spec published(int ageSeconds) {
            Spec spec = new Spec();
            spec.ageSeconds = ageSeconds;
            return spec;
        }

        Spec status(int value) {
            this.status = value;
            return this;
        }

        Spec seniority(Integer value) {
            this.seniority = value;
            return this;
        }

        Spec workMode(UUID value) {
            this.workMode = value;
            return this;
        }

        Spec contract(UUID value) {
            this.contract = value;
            return this;
        }

        Spec employment(UUID value) {
            this.employment = value;
            return this;
        }

        Spec country(String value) {
            this.country = value;
            return this;
        }

        Spec expiresAt(LocalDate value) {
            this.expiresAt = value;
            return this;
        }
    }

    @AfterEach
    void cleanupSearchData() {
        for (UUID offerId : createdOfferIds) {
            jdbcTemplate.update("DELETE FROM screening_job WHERE job_offer_id = ?", offerId);
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

    /** Jeton unique (lettres minuscules) : sépare les données de ce test de la base partagée. */
    protected static String uniqueToken() {
        return "zq" + UUID.randomUUID().toString().replace("-", "").substring(0, 10)
                .replaceAll("[0-9]", "k");
    }

    protected Owner owner(String companyName) throws Exception {
        String token = signup();
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
        return new Owner(token, createCompany(token, companyName));
    }

    protected UUID createCompany(String token, String name) throws Exception {
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

    /** Crée l'offre par l'API (DRAFT) puis applique {@code spec} en base. */
    protected UUID offer(Owner owner, UUID companyId, String title, Spec spec) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "%s",
                                  "description": "Build and own our platform APIs.",
                                  "seniority": "mid",
                                  "city": "Paris",
                                  "country": "FR",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ]
                                }
                                """.formatted(companyId, title, FULL_TIME, SKILL_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdOfferIds.add(offerId);
        jdbcTemplate.update("""
                UPDATE job_offer SET status = ?, seniority = ?, work_mode_id = ?, contract_type_id = ?,
                       employment_type_id = ?, country = ?, expires_at = ?,
                       created_at = now() - make_interval(secs => ?),
                       published_at = CASE WHEN ? >= 3 THEN now() - make_interval(secs => ?) ELSE NULL END
                WHERE id = ?""",
                spec.status, spec.seniority, spec.workMode, spec.contract, spec.employment, spec.country,
                spec.expiresAt, (double) spec.ageSeconds, spec.status, (double) spec.ageSeconds, offerId);
        return offerId;
    }

    /** Exécute la requête (200 attendu) et renvoie le corps JSON. */
    protected JsonNode ok(MockHttpServletRequestBuilder request) throws Exception {
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    protected static List<String> titlesOf(JsonNode page) {
        List<String> titles = new ArrayList<>();
        for (JsonNode item : page.get("items")) {
            titles.add(item.get("title").asText());
        }
        return titles;
    }

    private String signup() throws Exception {
        String email = "search-" + UUID.randomUUID() + "@example.com";
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
