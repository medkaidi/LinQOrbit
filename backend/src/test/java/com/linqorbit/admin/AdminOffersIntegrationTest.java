package com.linqorbit.admin;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Liste des offres admin — paramètres facultatifs de bout en bout : appel
 * nominal sans aucun paramètre, filtre de statut (renseigné, vide ≡ absent,
 * casse majuscule, valeur inconnue → 400) et bornes de pagination au niveau
 * HTTP. Les totaux sont assertés en delta par rapport à un relevé initial
 * (la base locale contient d'autres offres).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminOffersIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";

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
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", userId);
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
    void listeSansFiltresFiltresVidesEtCasse() throws Exception {
        String adminToken = adminToken();
        int totalAll = totalOf(getOffers(adminToken));
        int totalDraft = totalOf(getOffers(adminToken, "status", "draft"));

        seedTwoDraftOffers("offers-admin");

        // Appel nominal, aucun paramètre — l'enveloppe complète et le delta +2.
        mockMvc.perform(get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(totalAll + 2));

        // Filtre vide ≡ absent, taille par défaut renvoyée dans l'enveloppe.
        mockMvc.perform(get("/api/v1/admin/job-offers").param("status", "").param("size", "")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(totalAll + 2));

        // Filtre renseigné : delta sur les brouillons, casse indifférente.
        mockMvc.perform(get("/api/v1/admin/job-offers").param("status", "draft")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(totalDraft + 2));

        mockMvc.perform(get("/api/v1/admin/job-offers").param("status", "DRAFT")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(totalDraft + 2));

        // Filtre inconnu → 400 métier construit par nos soins.
        mockMvc.perform(get("/api/v1/admin/job-offers").param("status", "archived")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unsupported status filter"))
                .andExpect(jsonPath("$.detail")
                        .value("Only draft, validated, published and closed can be used as a status filter."));
    }

    @Test
    void bornesEtParametresInvalides() throws Exception {
        String adminToken = adminToken();
        List<UUID> offerIds = seedTwoDraftOffers("offers-admin-bornes");
        UUID newestOfferId = offerIds.get(1);

        mockMvc.perform(get("/api/v1/admin/job-offers").param("size", "500")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(50));

        mockMvc.perform(get("/api/v1/admin/job-offers").param("size", "0")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.items.length()").value(1));

        mockMvc.perform(get("/api/v1/admin/job-offers").param("page", "-3")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));

        mockMvc.perform(get("/api/v1/admin/job-offers").param("page", "")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));

        mockMvc.perform(get("/api/v1/admin/job-offers").param("page", "9999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(9999))
                .andExpect(jsonPath("$.items").isEmpty());

        // Paramètre non numérique : entrée client invalide → 400 générique.
        mockMvc.perform(get("/api/v1/admin/job-offers").param("page", "abc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));

        // La plus récente des offres seedées est bien servie par la première page.
        mockMvc.perform(get("/api/v1/admin/job-offers").param("size", "1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(newestOfferId.toString()));
    }

    private MvcResult getOffers(String token, String... queryParams) throws Exception {
        var request = get("/api/v1/admin/job-offers").header("Authorization", "Bearer " + token);
        for (int i = 0; i < queryParams.length; i += 2) {
            request = request.param(queryParams[i], queryParams[i + 1]);
        }
        return mockMvc.perform(request).andExpect(status().isOk()).andReturn();
    }

    private int totalOf(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("total").asInt();
    }

    /** Recruteur + company + deux brouillons (les plus récents) proprement nettoyés. */
    private List<UUID> seedTwoDraftOffers(String prefix) throws Exception {
        String token = signup(prefix);
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());

        MvcResult company = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + prefix + " Co\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(company.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);

        List<UUID> offerIds = new ArrayList<>();
        for (String title : List.of("Backend Engineer", "Frontend Engineer")) {
            MvcResult offer = mockMvc.perform(post("/api/v1/job-offers")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
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
                                    """.formatted(companyId, title, EMPLOYMENT_TYPE_ID, SKILL_ID)))
                    .andExpect(status().isCreated())
                    .andReturn();
            UUID offerId = UUID.fromString(objectMapper.readTree(offer.getResponse().getContentAsString())
                    .get("id").asText());
            offerIds.add(offerId);
            createdOfferIds.add(offerId);
        }
        return offerIds;
    }

    private String signup(String prefix) throws Exception {
        String email = prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
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
        UUID id = UUID.fromString(body.get("user").get("id").asText());
        createdUserIds.add(id);
        return body.get("token").asText();
    }

    /**
     * Jeton ADMIN : le rôle est inséré après le signup, donc un nouveau login
     * est nécessaire pour que le claim {@code roles} le porte.
     */
    private String adminToken() throws Exception {
        String prefix = "admin-offers-it-" + UUID.randomUUID().toString().substring(0, 8);
        String email = prefix + "@example.com";
        MvcResult signupResult = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Admin",
                                  "lastName": "Zadmin",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(signupResult.getResponse().getContentAsString())
                .get("user").get("id").asText());
        createdUserIds.add(id);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", id);

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "secret123"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();
    }
}
