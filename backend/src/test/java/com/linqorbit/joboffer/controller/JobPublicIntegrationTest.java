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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Lecture publique d'offre (V15) : sans jeton, une offre PUBLISHED non
 * expirée est lisible par public_id ; le même 404 sûr couvre inconnu, non
 * publié, clôturé et expiré. Le slug suit le titre, le publicId ne bouge
 * jamais. Le worker est mocké pour empêcher tout dispatch asynchrone vers
 * l'IA (jobs PENDING, assertions déterministes) — pattern
 * NormalizationValidateIntegrationTest.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobPublicIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String SKILL_AWS_ID = "a0000000-0000-4000-8000-000000000023";
    private static final String SKILL_K8S_ID = "a0000000-0000-4000-8000-000000000020";
    private static final String SKILL_REACT_ID = "a0000000-0000-4000-8000-000000000005";
    private static final String SKILL_PG_ID = "a0000000-0000-4000-8000-000000000015";
    private static final String SKILL_DOCKER_ID = "a0000000-0000-4000-8000-000000000019";
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

    @MockitoBean
    private NormalizationWorker normalizationWorker;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            // La validation crée un couple profil + job (normalisation) : à
            // nettoyer avant l'offre (FK normalized_profile_job_offer).
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_job_offer npo
                    WHERE npo.normalized_profile_id = j.job_id AND npo.job_offer_id = ?""", offerId);
            // La publication crée un job de screening (FK vers la fiche, T-101) : à retirer avant les fiches.
            jdbcTemplate.update("DELETE FROM screening_job WHERE job_offer_id = ?", offerId);
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

        // Aucune autre offre dans l'entreprise : liste vide, pas d'erreur.
        mockMvc.perform(get("/api/v1/jobs/" + publicId + "/related"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
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

        // Les « autres offres » suivent le même gate : 404 sûr sur l'offre de référence.
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(draftId) + "/related"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(closedId) + "/related"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(expiredId) + "/related"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/jobs/zzzzzzzzzzzz/related"))
                .andExpect(status().isNotFound());
    }

    @Test
    void relatedRenvoieLesAutresOffresPublieesDeLaMemeCompany() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID currentId = createOffer(token, "Current Offer");
        publish(token, currentId);
        UUID secondId = createOffer(token, "Second Offer");
        publish(token, secondId);
        UUID thirdId = createOffer(token, "Third Offer");
        publish(token, thirdId);
        UUID expiredId = createOffer(token, "Expired Offer");
        publish(token, expiredId);
        jdbcTemplate.update("UPDATE job_offer SET expires_at = CURRENT_DATE - 1 WHERE id = ?", expiredId);
        createOffer(token, "Draft Offer");
        // Autre entreprise : jamais mélangée.
        String otherToken = ownerWithCompany("Globex");
        UUID globexId = createOffer(otherToken, "Globex Offer");
        publish(otherToken, globexId);
        // Ordre de publication forcé : Third (le plus récent) > Second > Current.
        jdbcTemplate.update("UPDATE job_offer SET published_at = now() - interval '2 second' WHERE id = ?",
                currentId);
        jdbcTemplate.update("UPDATE job_offer SET published_at = now() - interval '1 second' WHERE id = ?",
                secondId);

        MvcResult result = mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(currentId) + "/related"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Third Offer"))
                .andExpect(jsonPath("$[1].title").value("Second Offer"))
                .andExpect(jsonPath("$[0].companyName").value("Acme"))
                .andExpect(jsonPath("$[0].publicId").isNotEmpty())
                .andExpect(jsonPath("$[0].skills[0]").value("Java"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        List<String> publicIds = new ArrayList<>();
        List<String> titles = new ArrayList<>();
        for (JsonNode item : body) {
            publicIds.add(item.get("publicId").asText());
            titles.add(item.get("title").asText());
        }
        assertThat(publicIds).doesNotContain(publicIdOf(currentId), publicIdOf(expiredId),
                publicIdOf(globexId));
        assertThat(titles).doesNotContain("Current Offer", "Draft Offer", "Expired Offer", "Globex Offer");
        // Ligne légère : ni description, ni statut, ni signal de gestion.
        assertThat(body.get(0).has("description")).isFalse();
        assertThat(body.get(0).has("status")).isFalse();
        assertThat(body.get(0).has("recruiterId")).isFalse();

        // Symétrie : la fiche de la seconde offre liste les deux autres.
        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(secondId) + "/related"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("Third Offer"))
                .andExpect(jsonPath("$[1].title").value("Current Offer"));
    }

    @Test
    void relatedBorneLaListeParLeBackend() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID currentId = createOffer(token, "Current Offer");
        publish(token, currentId);
        for (int i = 1; i <= 4; i++) {
            UUID id = createOffer(token, "Extra Offer " + i);
            publish(token, id);
            jdbcTemplate.update(
                    "UPDATE job_offer SET published_at = now() - interval '" + (5 - i) + " second' WHERE id = ?",
                    id);
        }

        mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(currentId) + "/related"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("Extra Offer 4"))
                .andExpect(jsonPath("$[1].title").value("Extra Offer 3"))
                .andExpect(jsonPath("$[2].title").value("Extra Offer 2"));
    }

    @Test
    void jobBoardNeListeQueLesOffresPublieesNonExpireesDansLOrdreDePublication() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID newerId = createOffer(token, "Newer Offer");
        publish(token, newerId);
        UUID olderId = createOffer(token, "Older Offer");
        publish(token, olderId);
        UUID expiredId = createOffer(token, "Expired Offer");
        publish(token, expiredId);
        jdbcTemplate.update("UPDATE job_offer SET expires_at = CURRENT_DATE - 1 WHERE id = ?", expiredId);
        createOffer(token, "Draft Offer");
        // Ordre déterministe : une seconde d'écart entre les deux publications
        // (le reste de la base a des dates bien antérieures).
        jdbcTemplate.update("UPDATE job_offer SET published_at = now() - interval '1 second' WHERE id = ?",
                olderId);

        long expectedTotal = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM job_offer
                WHERE status = 3 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)""", Long.class);

        MvcResult result = mockMvc.perform(get("/api/v1/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(expectedTotal))
                .andExpect(jsonPath("$.items[0].title").value("Newer Offer"))
                .andExpect(jsonPath("$.items[0].companyName").value("Acme"))
                .andExpect(jsonPath("$.items[0].publicId").isNotEmpty())
                .andExpect(jsonPath("$.items[0].contractType").value("Permanent"))
                .andExpect(jsonPath("$.items[0].skills[0]").value("Java"))
                .andExpect(jsonPath("$.items[0].skills.length()").value(1))
                .andExpect(jsonPath("$.items[1].title").value("Older Offer"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(itemTitles(body))
                .doesNotContain("Expired Offer", "Draft Offer");
        // Ligne légère : ni description, ni statut, ni signal de gestion.
        assertThat(body.get("items").get(0).has("description")).isFalse();
        assertThat(body.get("items").get(0).has("status")).isFalse();
        assertThat(body.get("items").get(0).has("recruiterId")).isFalse();
    }

    @Test
    void jobBoardExposeToutesLesCompetencesOrdonneesParPoidsPuisNom() throws Exception {
        String token = ownerWithCompany("Acme");
        // Six compétences, volontairement dans le désordre : aucune n'est omise
        // (pas de plafond T-76), poids décroissant puis nom croissant à poids égal.
        UUID offerId = createOffer(token, "Skills Offer", """
                {"skillId": "%s", "requirementType": "mandatory", "weight": 2},
                {"skillId": "%s", "requirementType": "preferred", "weight": 5},
                {"skillId": "%s", "requirementType": "preferred", "weight": 4},
                {"skillId": "%s", "requirementType": "mandatory", "weight": 5},
                {"skillId": "%s", "requirementType": "preferred", "weight": 2},
                {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                """.formatted(SKILL_ID, SKILL_AWS_ID, SKILL_REACT_ID, SKILL_K8S_ID, SKILL_PG_ID,
                SKILL_DOCKER_ID));
        publish(token, offerId);

        mockMvc.perform(get("/api/v1/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Skills Offer"))
                .andExpect(jsonPath("$.items[0].skills.length()").value(6))
                .andExpect(jsonPath("$.items[0].skills[0]").value("AWS"))
                .andExpect(jsonPath("$.items[0].skills[1]").value("Kubernetes"))
                .andExpect(jsonPath("$.items[0].skills[2]").value("Docker"))
                .andExpect(jsonPath("$.items[0].skills[3]").value("React"))
                .andExpect(jsonPath("$.items[0].skills[4]").value("Java"))
                .andExpect(jsonPath("$.items[0].skills[5]").value("PostgreSQL"));
    }

    @Test
    void jobBoardBorneLaPageEtTraiteLesEntreesFacultatives() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID offerId = createOffer(token, "Paged Offer");
        publish(token, offerId);
        String title = "Paged Offer";

        long total = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM job_offer
                WHERE status = 3 AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)""", Long.class);

        // Absent ≡ vide ≡ négatif : page 0, première page servie.
        mockMvc.perform(get("/api/v1/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));
        mockMvc.perform(get("/api/v1/jobs").param("page", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));
        mockMvc.perform(get("/api/v1/jobs").param("page", "-3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));

        // Page hors plage : items vides, total inchangé.
        mockMvc.perform(get("/api/v1/jobs").param("page", "9999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(9999))
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.total").value(total));

        // Invalide : 400 générique (jamais un message brut de framework).
        mockMvc.perform(get("/api/v1/jobs").param("page", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));

        // Contrôle de sanité : l'offre du test est bien dans la première page.
        MvcResult result = mockMvc.perform(get("/api/v1/jobs")).andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(itemTitles(body)).contains(title);
    }

    private static List<String> itemTitles(JsonNode body) {
        List<String> titles = new ArrayList<>();
        JsonNode items = body.get("items");
        for (int i = 0; i < items.size(); i++) {
            titles.add(items.get(i).get("title").asText());
        }
        return titles;
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
                                {
                                  "title": "Senior Backend Engineer",
                                  "description": "Build and own our platform APIs.",
                                  "country": "FR",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ]
                                }
                                """.formatted(EMPLOYMENT_TYPE_ID, SKILL_ID)))
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
        return createOffer(token, title, "{\"skillId\": \"%s\", \"requirementType\": \"mandatory\", \"weight\": 4}"
                .formatted(SKILL_ID));
    }

    private UUID createOffer(String token, String title, String skillsJson) throws Exception {
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
                                    %s
                                  ],
                                  "languages": [
                                    {"languageId": "%s", "level": "B2", "isRequired": true}
                                  ]
                                }
                                """.formatted(companyId, title, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID,
                                WORK_MODE_ID, skillsJson, LANGUAGE_ID)))
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
