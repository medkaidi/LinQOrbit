package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;

/**
 * Revue admin des suggestions de compétences — impact sur le profil candidat
 * (T-115, D102).
 *
 * <p>Comportement vérifié ici : l'ajout d'une compétence au profil par l'admin
 * est une <b>modification du profil</b>. La ligne {@code candidates} doit donc
 * être bumper ({@code updated_at}) : sans cela le signal « modifications non
 * validées » restait faux pour un candidat déjà validé, la fiche normalisée
 * n'était pas régénérée et le matching/screening ignoraient la compétence
 * jusqu'à ce que le candidat modifie autre chose.</p>
 *
 * <p>Scénarios : candidat déjà validé (dirty faux puis vrai après approbation),
 * rejet (aucun bump), doublon déjà au profil (aucun bump), groupe homonyme
 * insensible à la casse (tous les auteurs bumpés), candidat jamais validé (dirty
 * déjà vrai), rattachement à une compétence existante (bump).</p>
 *
 * <p>Base de dev partagée : seules les lignes créées par le test sont
 * supprimées — y compris les compétences créées au catalogue par l'approbation
 * (noms uniques, préfixe {@code Admin IT Skill}).</p>
 */
class AdminSkillSuggestionIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";
    private static final String SUGGESTIONS_PATH = "/api/v1/admin/skill-suggestions";
    /** Catégorie du catalogue (V6) : la validation de l'approbation l'exige. */
    private static final String CATEGORY = "Programming Languages";
    /** Préfixe des compétences créées par ce test — jamais une ligne du catalogue. */
    private static final String SKILL_PREFIX = "Admin IT Skill ";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private EmbeddingTestData data;
    private UUID adminId;
    private final List<String> createdSkillNames = new ArrayList<>();

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        adminId = data.bareUser();
        jdbc.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", adminId);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM user_roles WHERE user_id = ?", adminId);
        // Les candidats (et donc leurs compétences de profil et leurs suggestions)
        // disparaissent d'abord : les compétences créées au catalogue n'ont plus
        // de référent ensuite.
        data.cleanup();
        for (String name : createdSkillNames) {
            jdbc.update("DELETE FROM skills WHERE name = ?", name);
        }
        createdSkillNames.clear();
    }

    // --- régression : le signal « modifications non validées » doit s'allumer -------

    @Test
    void approbationSignaleLesModificationsNonValideesAuCandidatDejaValide() throws Exception {
        UUID candidateId = validatedCandidate();
        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean())
                .as("le candidat vient d'être validé : rien à revalider")
                .isFalse();

        String skillName = uniqueSkillName();
        UUID suggestionId = suggest(candidateId, skillName);

        approve(suggestionId);

        JsonNode profile = profile(candidateId);
        assertThat(profile.get("hasUnvalidatedChanges").asBoolean())
                .as("l'ajout admin modifie le profil : le candidat doit revalider")
                .isTrue();
        JsonNode skill = profile.get("skills").get(0);
        assertThat(skill.get("name").asText()).isEqualTo(skillName);
        assertThat(skill.get("level").asInt()).isEqualTo(1);
        assertThat(skill.get("yearsExperience").isNull())
                .as("l'ajout admin ne connaît pas l'expérience : elle reste vide")
                .isTrue();
        // La suggestion quitte la file de revue.
        assertThat(suggestionCount(candidateId)).isZero();
    }

    @Test
    void leRattachementSignaleEgaluementLesModificationsNonValidees() throws Exception {
        UUID candidateId = validatedCandidate();
        UUID suggestionId = suggest(candidateId, uniqueSkillName());

        link(suggestionId, catalogueSkillId("Java"));

        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean()).isTrue();
        assertThat(profile(candidateId).get("skills").get(0).get("name").asText()).isEqualTo("Java");
    }

    // --- cas limites : rien ne doit bouger quand le profil ne change pas ----------

    @Test
    void leRejetNeSigneAucuneModification() throws Exception {
        UUID candidateId = validatedCandidate();
        LocalDateTime before = updatedAt(candidateId);
        UUID suggestionId = suggest(candidateId, uniqueSkillName());

        reject(suggestionId);

        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean()).isFalse();
        assertThat(updatedAt(candidateId)).isEqualTo(before);
        assertThat(profile(candidateId).get("skills")).isEmpty();
    }

    @Test
    void unDoublonDejaAuProfilNeSigneAucuneModification() throws Exception {
        UUID candidateId = validatedCandidate();
        UUID javaId = catalogueSkillId("Java");
        // Le candidat a déjà « Java » au niveau 3 : l'approbation ne doit rien
        // changer (ni doublon, ni « Validate again » inutile).
        jdbc.update("""
                INSERT INTO candidate_skills (id, candidate_id, skill_id, level, years_experience)
                VALUES (?, ?, ?, 3, 5)""", UUID.randomUUID(), candidateId, javaId);
        LocalDateTime before = updatedAt(candidateId);
        UUID suggestionId = suggest(candidateId, "Java");

        approve(suggestionId);

        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean()).isFalse();
        assertThat(updatedAt(candidateId)).isEqualTo(before);
        JsonNode skills = profile(candidateId).get("skills");
        assertThat(skills).hasSize(1);
        assertThat(skills.get(0).get("level").asInt()).isEqualTo(3);
        assertThat(skills.get(0).get("yearsExperience").asInt()).isEqualTo(5);
    }

    // --- groupe homonyme insensible à la casse -------------------------------------

    @Test
    void leGroupeHomonymeInsensibleALaCasseSigneTousLesAuteurs() throws Exception {
        UUID first = validatedCandidate();
        UUID second = validatedCandidate();
        String skillName = uniqueSkillName();
        UUID firstSuggestion = suggest(first, skillName);
        // Même nom, casse différente : la décision frappe le groupe entier.
        UUID secondSuggestion = suggest(second, skillName.toLowerCase());
        assertThat(secondSuggestion).isNotEqualTo(firstSuggestion);

        approve(firstSuggestion);

        assertThat(profile(first).get("hasUnvalidatedChanges").asBoolean()).isTrue();
        assertThat(profile(second).get("hasUnvalidatedChanges").asBoolean()).isTrue();
        assertThat(profile(first).get("skills").get(0).get("name").asText()).isEqualTo(skillName);
        assertThat(profile(second).get("skills").get(0).get("name").asText()).isEqualTo(skillName);
    }

    // --- candidat jamais validé ----------------------------------------------------

    @Test
    void unCandidatJamaisValideResteDejaEnSignalDeModification() throws Exception {
        UUID candidateId = data.candidate(null);
        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean())
                .as("jamais validé : le signal est déjà vrai")
                .isTrue();
        // Horodatage de référence aligné sur l'horloge de l'application (Java) :
        // la comparaison ne doit pas dépendre du fuseau du serveur PostgreSQL
        // (fixtures en UTC, application en heure locale).
        LocalDateTime before = LocalDateTime.now().minusHours(2);
        jdbc.update("UPDATE candidates SET updated_at = ? WHERE id = ?", before, candidateId);

        approve(suggest(candidateId, uniqueSkillName()));

        assertThat(profile(candidateId).get("hasUnvalidatedChanges").asBoolean()).isTrue();
        assertThat(updatedAt(candidateId)).isAfter(before);
    }

    // --- aides ---------------------------------------------------------------------

    /** Candidat dont la fiche a été validée dans le passé : dirty = false. */
    private UUID validatedCandidate() {
        UUID candidateId = data.candidate(null);
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        jdbc.update("UPDATE candidates SET updated_at = ? WHERE id = ?", validatedAt.minusMinutes(1), candidateId);
        data.candidateFiche(candidateId, 1, "{}", validatedAt);
        return candidateId;
    }

    /** Suggestion en file pour le candidat ; l'id est pré-assigné (comme en production). */
    private UUID suggest(UUID candidateId, String name) {
        UUID suggestionId = UUID.randomUUID();
        jdbc.update("INSERT INTO skill_suggestions (id, candidate_id, name, created_at) VALUES (?, ?, ?, now())",
                suggestionId, candidateId, name);
        return suggestionId;
    }

    private void approve(UUID suggestionId) throws Exception {
        mockMvc.perform(post(SUGGESTIONS_PATH + "/" + suggestionId + "/approve")
                        .with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"" + CATEGORY + "\",\"skillType\":\"tech\"}"))
                .andExpect(status().isNoContent());
    }

    private void link(UUID suggestionId, UUID skillId) throws Exception {
        mockMvc.perform(post(SUGGESTIONS_PATH + "/" + suggestionId + "/link")
                        .with(asAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skillId\":\"" + skillId + "\"}"))
                .andExpect(status().isNoContent());
    }

    private void reject(UUID suggestionId) throws Exception {
        mockMvc.perform(post(SUGGESTIONS_PATH + "/" + suggestionId + "/reject").with(asAdmin()))
                .andExpect(status().isNoContent());
    }

    private JsonNode profile(UUID candidateId) throws Exception {
        MvcResult result = mockMvc.perform(get(PROFILE_PATH).with(jwt().jwt(token -> token.subject(candidateId.toString()))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private LocalDateTime updatedAt(UUID candidateId) {
        return jdbc.queryForObject("SELECT updated_at FROM candidates WHERE id = ?", LocalDateTime.class, candidateId);
    }

    private int suggestionCount(UUID candidateId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM skill_suggestions WHERE candidate_id = ?", Integer.class, candidateId);
        return count == null ? 0 : count;
    }

    private UUID catalogueSkillId(String name) {
        return jdbc.queryForObject("SELECT id FROM skills WHERE name = ?", UUID.class, name);
    }

    /** Nom de compétence unique : la ligne créée au catalogue est supprimée au nettoyage. */
    private String uniqueSkillName() {
        String name = SKILL_PREFIX + UUID.randomUUID();
        createdSkillNames.add(name);
        return name;
    }

    private RequestPostProcessor asAdmin() {
        return jwt().jwt(token -> token.subject(adminId.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
