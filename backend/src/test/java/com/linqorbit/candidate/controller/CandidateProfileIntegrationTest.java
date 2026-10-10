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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class CandidateProfileIntegrationTest {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    void profilVidePuisRenseignementProgressifJusquAuPourCent() throws Exception {
        String token = signup();
        String skillsJson = referenceJson(token, "skills");
        String degreesJson = referenceJson(token, "degrees");
        String studyFieldsJson = referenceJson(token, "study-fields");
        String languagesJson = referenceJson(token, "languages");
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.about").exists())
                .andExpect(jsonPath("$.experiences").isEmpty())
                .andExpect(jsonPath("$.projects").isEmpty())
                .andExpect(jsonPath("$.completionPercentage").value(0));
        assertThat(countCandidates(userId)).isZero();

        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full-stack Developer", "bio": "Profil construit en une requête",
                                 "yearsOfExperience": 6, "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());
        assertThat(countCandidates(userId)).isEqualTo(1);

        mockMvc.perform(put(PROFILE_PATH + "/experiences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [
                                  {"positionTitle": "Developer", "companyName": "Acme", "companyCountry": "fr",
                                   "startDate": "2021-03-01", "endDate": "2023-02-28"},
                                  {"positionTitle": "Lead Developer", "companyName": "Globex",
                                   "startDate": "2023-03-01", "description": "Encadrement de l'équipe"}
                                ]"""))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT end_date FROM professional_experiences WHERE candidate_id = ? AND sort_order = 1",
                String.class, userId)).isNull();

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.about.title").value("Full-stack Developer"))
                .andExpect(jsonPath("$.about.searchStatus").value("open_to_work"))
                .andExpect(jsonPath("$.experiences.length()").value(2))
                .andExpect(jsonPath("$.experiences[0].positionTitle").value("Developer"))
                .andExpect(jsonPath("$.completionPercentage").value(28));

        mockMvc.perform(put(PROFILE_PATH + "/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"name": "Portfolio", "role": "Author", "description": "Site personnel",
                                  "startDate": "2023-01-01", "endDate": null,
                                  "technologies": "Next.js, TypeScript"}]"""))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT end_date FROM candidate_projects WHERE candidate_id = ? AND sort_order = 0",
                String.class, userId)).isNull();

        String degreeId = firstId(degreesJson);
        String studyFieldId = firstId(studyFieldsJson);
        String skillId = firstId(skillsJson);
        String languageId = firstId(languagesJson);

        mockMvc.perform(put(PROFILE_PATH + "/diplomas")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"title": "Master Informatique", "institution": "Sorbonne",
                                  "institutionCountry": "fr", "startDate": "2018-09-01", "endDate": "2020-06-30",
                                  "degreeId": "%s", "studyFieldId": "%s"}]"""
                                .formatted(degreeId, studyFieldId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put(PROFILE_PATH + "/skills")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"skillId": "%s", "level": 4, "yearsExperience": 5}]""".formatted(skillId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put(PROFILE_PATH + "/languages")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"languageId": "%s", "level": "C1"}]""".formatted(languageId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put(PROFILE_PATH + "/links")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"label": "GitHub", "url": "https://github.com/ada", "linkType": "github"}]"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.length()").value(1))
                .andExpect(jsonPath("$.projects[0].name").value("Portfolio"))
                .andExpect(jsonPath("$.diplomas[0].degreeLabel").isNotEmpty())
                .andExpect(jsonPath("$.diplomas[0].studyFieldLabel").isNotEmpty())
                .andExpect(jsonPath("$.skills[0].name").isNotEmpty())
                .andExpect(jsonPath("$.skills[0].skillType").isNotEmpty())
                .andExpect(jsonPath("$.languages[0].symbol").isNotEmpty())
                .andExpect(jsonPath("$.links[0].linkType").value("github"))
                .andExpect(jsonPath("$.completionPercentage").value(100));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT title FROM candidates WHERE id = ?", String.class, userId))
                .isEqualTo("Full-stack Developer");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT search_status FROM candidates WHERE id = ?", Short.class, userId))
                .isEqualTo((short) 1);
    }

    @Test
    void posteRechercheSeRefloteDansLeProfilEtSurvitALaMajAbout() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        mockMvc.perform(put(PROFILE_PATH + "/about/target-position")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPosition\": \"  Staff Engineer  \"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.about.targetPosition").value("Staff Engineer"));

        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Full-stack Developer", "bio": "Bio", "yearsOfExperience": 5,
                                 "searchStatus": "open_to_work"}"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.about.title").value("Full-stack Developer"))
                .andExpect(jsonPath("$.about.targetPosition").value("Staff Engineer"));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT target_position FROM candidates WHERE id = ?", String.class, userId))
                .isEqualTo("Staff Engineer");
    }

    @Test
    void remplacementDExperiencesSupprimeLesAnciennesLignes() throws Exception {
        String token = signup();

        mockMvc.perform(put(PROFILE_PATH + "/experiences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"positionTitle": "Developer", "companyName": "Acme", "startDate": "2022-01-01"}]"""))
                .andExpect(status().isNoContent());
        mockMvc.perform(put(PROFILE_PATH + "/experiences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"positionTitle": "Architect", "companyName": "Initech", "startDate": "2023-01-01"},
                                 {"positionTitle": "CTO", "companyName": "Umbrella", "startDate": "2024-01-01"}]"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experiences.length()").value(2))
                .andExpect(jsonPath("$.experiences[0].positionTitle").value("Architect"));
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM professional_experiences WHERE candidate_id = ?", Integer.class, userId))
                .isEqualTo(2);
    }

    @Test
    void remplacementDeProjetsSupprimeLesAnciennesLignes() throws Exception {
        String token = signup();

        mockMvc.perform(put(PROFILE_PATH + "/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"name": "Portfolio", "startDate": "2023-01-01"}]"""))
                .andExpect(status().isNoContent());
        mockMvc.perform(put(PROFILE_PATH + "/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"name": "Bot Discord", "startDate": "2024-01-01"},
                                 {"name": "Jeu en C++", "startDate": "2020-01-01", "endDate": "2021-06-01"}]"""))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(PROFILE_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.length()").value(2))
                .andExpect(jsonPath("$.projects[0].name").value("Bot Discord"));
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM candidate_projects WHERE candidate_id = ?", Integer.class, userId))
                .isEqualTo(2);
    }

    @Test
    void listesDeReferenceSontAlimenteesEtAccessiblesAvecUnJeton() throws Exception {
        String token = signup();

        MvcResult skills = mockMvc.perform(get("/api/v1/candidates/reference/skills")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode skillNodes = objectMapper.readTree(skills.getResponse().getContentAsString());
        assertThat(skillNodes.size()).isGreaterThanOrEqualTo(60);
        List<String> skillTypes = new ArrayList<>();
        skillNodes.forEach(node -> skillTypes.add(node.get("skillType").asText()));
        assertThat(skillTypes).contains("tech", "soft");

        mockMvc.perform(get("/api/v1/candidates/reference/languages")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(47));
        mockMvc.perform(get("/api/v1/candidates/reference/degrees")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6));
        mockMvc.perform(get("/api/v1/candidates/reference/study-fields")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(24));
    }

    @Test
    void reglesMetierSontRejeteesAvecUnProblemDetail() throws Exception {
        String token = signup();
        UUID unknownSkill = UUID.randomUUID();

        mockMvc.perform(put(PROFILE_PATH + "/experiences")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"positionTitle": "Developer", "companyName": "Acme",
                                  "startDate": "2023-01-01", "endDate": "2022-01-01"}]"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid profile section"));

        mockMvc.perform(put(PROFILE_PATH + "/skills")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"skillId": "%s", "level": 3}]""".formatted(unknownSkill)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unknown reference"));

        mockMvc.perform(put(PROFILE_PATH + "/links")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"label": "GitHub", "url": "https://github.com/ada", "linkType": "github",
                                  "issuer": "OpenClassrooms"}]"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid profile section"));

        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Dev", "bio": null, "yearsOfExperience": 3,
                                 "searchStatus": "pas-un-statut"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid profile section"));
    }

    @Test
    void profilCandidatExigeUnJeton() throws Exception {
        mockMvc.perform(get(PROFILE_PATH)).andExpect(status().isUnauthorized());
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title": "Dev", "bio": "Bio", "yearsOfExperience": 1,
                                 "searchStatus": "open_to_work"}"""))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/candidates/reference/skills"))
                .andExpect(status().isUnauthorized());
    }

    private String signup() throws Exception {
        String email = "candidate-" + UUID.randomUUID() + "@example.com";
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

    private String referenceJson(String token, String reference) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/candidates/reference/" + reference)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getContentAsString();
    }

    private String firstId(String jsonArray) throws Exception {
        return objectMapper.readTree(jsonArray).get(0).get("id").asText();
    }

    private int countCandidates(UUID userId) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM candidates WHERE id = ?", Integer.class, userId);
    }
}
