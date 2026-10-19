package com.linqorbit.candidate.controller;

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
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Flux de validation explicite contre PostgreSQL : dirty-flag, création du
 * couple profil + job, versioning, supersede des jobs en attente, no-op.
 * Le worker est mocké pour empêcher tout dispatch asynchrone : les jobs
 * doivent rester PENDING, les assertions sont déterministes.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NormalizationValidateIntegrationTest {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private NormalizationWorker normalizationWorker;

    private final List<UUID> createdUserIds = new ArrayList<>();

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
    }

    @Test
    void validationExpliciteCreeLesVersionsEtSupersedeLesJobsEnAttente() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(false));

        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full Stack Developer", "bio": "Profil de test",
                                 "yearsOfExperience": 6, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(true));

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(true));
        assertThat(profileCount(userId)).isEqualTo(1);
        assertThat(latestVersion(userId)).isEqualTo(1);
        assertThat(jobStatus(latestProfileId(userId))).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(contentOf(latestProfileId(userId))).isNull();

        mockMvc.perform(put(PROFILE_PATH + "/experiences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"positionTitle": "Developer", "description": "Backend",
                                  "startDate": "2024-01-01", "endDate": null,
                                  "companyName": "A2S", "companyCountry": "FR"}]"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(true));

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(profileCount(userId)).isEqualTo(2);
        assertThat(latestVersion(userId)).isEqualTo(2);
        assertThat(jobStatus(latestProfileId(userId))).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(jobStatus(profileIdOfVersion(userId, 1))).isEqualTo(NormalizationJobStatus.SUPERSEDED);

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(profileCount(userId)).isEqualTo(2);
        assertThat(jobCount(userId)).isEqualTo(2);
    }

    @Test
    void validationRefusee409SurUnProfilJamaisEcrit() throws Exception {
        String token = signup();

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Empty profile"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("no content yet")));
    }

    @Test
    void getProfileSignaleLEchecEtAutoriseLaRelanceSansChangement() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationFailed").value(false));

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

        UUID firstJobId = latestProfileId(userId);
        // Statut SMALLINT : 4 = FAILED.
        jdbcTemplate.update("""
                UPDATE normalization_job SET status = 4, attempts = 3, completed_at = now()
                WHERE job_id = ?""", firstJobId);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationFailed").value(true))
                .andExpect(jsonPath("$.normalizationInProgress").value(false))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false));

        // Relance acceptée même sans changement : le dernier job est en échec.
        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(profileCount(userId)).isEqualTo(2);
        assertThat(jobStatus(latestProfileId(userId))).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(jobStatus(firstJobId)).isEqualTo(NormalizationJobStatus.FAILED);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationFailed").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(true))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false));
    }

    // --- D63 : analyse obsolète, dérivée de la dernière fiche AVEC contenu ----

    @Test
    void sansFicheAvecContenuLAnalyseNEstJamaisObsolete() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        expectSignals(token, false, false, false);

        writeAboutAndValidate(token);
        // Version 1 en cours, contenu absent : aucune fiche de référence, rien d'obsolète.
        assertThat(profileCount(userId)).isEqualTo(1);
        expectSignals(token, false, true, false);
    }

    @Test
    void ficheALaVersionCouranteNEstPasObsoleteEtLaValidationResteUnNoOp() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        writeAboutAndValidate(token);
        completeWithSchema(latestProfileId(userId), "3");

        expectSignals(token, false, false, false);
        mockMvc.perform(post(PROFILE_PATH + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(profileCount(userId)).isEqualTo(1);
    }

    @Test
    void ficheDUneAutreVersionEstObsoleteEtSeRevalideSansModification() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        writeAboutAndValidate(token);
        UUID firstId = latestProfileId(userId);
        completeWithSchema(firstId, "2");

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.analysisOutdated").value(true))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andExpect(jsonPath("$.normalizationFailed").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(false));

        // Fin du no-op : la fiche obsolète suffit à relancer, sans aucune modification.
        mockMvc.perform(post(PROFILE_PATH + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(profileCount(userId)).isEqualTo(2);
        UUID secondId = latestProfileId(userId);
        assertThat(schemaVersionOf(secondId)).isEqualTo("3");
        assertThat(jobStatus(secondId)).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(contentOf(secondId)).isNull();
        // La référence reste la v1 tant que la v2 n'a pas de contenu.
        expectSignals(token, false, true, true);

        // Double-clic pendant l'analyse : no-op, aucune troisième version.
        mockMvc.perform(post(PROFILE_PATH + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(profileCount(userId)).isEqualTo(2);

        completeWithSchema(secondId, "3");
        expectSignals(token, false, false, false);
    }

    @Test
    void laReferenceEstLaDerniereFicheAvecContenuJamaisUneVersionSansContenu() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        writeAboutAndValidate(token);
        UUID firstId = latestProfileId(userId);
        completeWithSchema(firstId, "3");
        // v2 au schéma périmé, mais sans contenu (échec) : elle ne remplace pas la référence v1.
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Backend Developer", "bio": "Profil modifié",
                                 "yearsOfExperience": 7, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(PROFILE_PATH + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        UUID secondId = latestProfileId(userId);
        jdbcTemplate.update("UPDATE normalized_profile SET schema_version = '2' WHERE normalized_profile_id = ?",
                secondId);
        jdbcTemplate.update("UPDATE normalization_job SET status = 4, attempts = 3 WHERE job_id = ?", secondId);

        expectSignals(token, true, false, false);

        // v1 périmée, v2 courante avec contenu : la plus récente avec contenu gagne.
        jdbcTemplate.update("UPDATE normalized_profile SET schema_version = '2' WHERE normalized_profile_id = ?",
                firstId);
        completeWithSchema(secondId, "3");
        expectSignals(token, false, false, false);
    }

    /** Signaux du GET : normalizationFailed, normalizationInProgress, analysisOutdated. */
    private void expectSignals(String token, boolean failed, boolean inProgress, boolean outdated) throws Exception {
        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationFailed").value(failed))
                .andExpect(jsonPath("$.normalizationInProgress").value(inProgress))
                .andExpect(jsonPath("$.analysisOutdated").value(outdated));
    }

    private void writeAboutAndValidate(String token) throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full Stack Developer", "bio": "Profil de test",
                                 "yearsOfExperience": 6, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(PROFILE_PATH + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    /** Fin d'analyse simulée : ligne au schéma donné, contenu cohérent, job DONE (3). */
    private void completeWithSchema(UUID profileId, String schemaVersion) {
        jdbcTemplate.update("""
                UPDATE normalized_profile SET schema_version = ?, content = CAST(? AS jsonb)
                WHERE normalized_profile_id = ?""",
                schemaVersion, "{\"schemaVersion\": \"" + schemaVersion + "\"}", profileId);
        jdbcTemplate.update("UPDATE normalization_job SET status = 3, completed_at = now() WHERE job_id = ?",
                profileId);
    }

    private String schemaVersionOf(UUID profileId) {
        return jdbcTemplate.queryForObject(
                "SELECT schema_version FROM normalized_profile WHERE normalized_profile_id = ?",
                String.class, profileId);
    }

    private String signup() throws Exception {
        String email = "normalize-" + UUID.randomUUID() + "@example.com";
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

    private int profileCount(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FROM normalized_profile np
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?""", Integer.class, userId);
    }

    private int jobCount(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT count(*) FROM normalization_job j
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = j.job_id
                WHERE npc.candidate_id = ?""", Integer.class, userId);
    }

    private int latestVersion(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT max(np.version) FROM normalized_profile np
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?""", Integer.class, userId);
    }

    private UUID latestProfileId(UUID userId) {
        return jdbcTemplate.queryForObject("""
                SELECT np.normalized_profile_id FROM normalized_profile np
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ?
                ORDER BY np.version DESC LIMIT 1""", UUID.class, userId);
    }

    private UUID profileIdOfVersion(UUID userId, int version) {
        return jdbcTemplate.queryForObject("""
                SELECT np.normalized_profile_id FROM normalized_profile np
                    JOIN normalized_profile_candidate npc
                        ON npc.normalized_profile_id = np.normalized_profile_id
                WHERE npc.candidate_id = ? AND np.version = ?""", UUID.class, userId, version);
    }

    private NormalizationJobStatus jobStatus(UUID profileId) {
        Number status = jdbcTemplate.queryForObject(
                "SELECT status FROM normalization_job WHERE job_id = ?", Number.class, profileId);
        return NormalizationJobStatus.fromCode(status.shortValue());
    }

    private String contentOf(UUID profileId) {
        return jdbcTemplate.queryForObject(
                "SELECT content FROM normalized_profile WHERE normalized_profile_id = ?",
                String.class, profileId);
    }
}
