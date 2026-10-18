package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * Grille de critères extraite de la fiche offre v2 (D58) : cinq sections,
 * poids (fiche pour les compétences, 1 sinon), clés stables et tolérance
 * aux champs absents, vides ou invalides.
 */
class MatchingCriteriaBuilderTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private final MatchingCriteriaBuilder builder = new MatchingCriteriaBuilder();

    @Test
    void ficheCompleteDonneLesCinqSectionsDansLOrdreAvecPoidsEtAttentes() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {
                  "schemaVersion": "2",
                  "requiredSkills": [
                    {"name": "Java", "weight": 5, "level": 4, "minYears": 3, "origin": "declared"},
                    {"name": "Kubernetes", "weight": 3, "origin": "inferred"}
                  ],
                  "preferredSkills": [{"name": "React", "weight": 2}],
                  "languages": [
                    {"name": "English", "level": "C1", "required": true},
                    {"name": "German", "level": null, "required": false}
                  ],
                  "requiredYears": 5,
                  "requiredDegrees": [{"label": "Master", "source": "declared"}],
                  "requiredStudyFields": [{"label": "Computer Science", "source": "inferred"}],
                  "certifications": [{"name": "AWS Solutions Architect"}]
                }"""));

        assertThat(criteria).extracting(MatchingCriterion::key).containsExactly(
                "skill:java", "skill:kubernetes", "skill:react", "language:english", "language:german",
                "experience:total", "degree:master", "study-field:computer-science",
                "certification:aws-solutions-architect");
        assertThat(criteria).extracting(MatchingCriterion::section).containsExactly(
                MatchingSection.REQUIRED_SKILLS, MatchingSection.REQUIRED_SKILLS, MatchingSection.PREFERRED_SKILLS,
                MatchingSection.LANGUAGES, MatchingSection.LANGUAGES, MatchingSection.EXPERIENCE,
                MatchingSection.EDUCATION, MatchingSection.EDUCATION, MatchingSection.EDUCATION);
        // Compétences : poids de la fiche ; tout le reste, langues comprises : 1.
        assertThat(criteria).extracting(MatchingCriterion::weight).containsExactly(5, 3, 2, 1, 1, 1, 1, 1, 1);
        assertThat(criteria.get(0).requirement()).isEqualTo("level 4/5, at least 3 years");
        assertThat(criteria.get(1).requirement()).isNull();
        assertThat(criteria.get(3).requirement()).isEqualTo("CEFR C1, required");
        assertThat(criteria.get(4).requirement()).isEqualTo("Any level, nice to have");
        assertThat(criteria.get(5).requirement())
                .isEqualTo("At least 5 years of experience relevant to this role");
        assertThat(criteria.get(6).label()).isEqualTo("Degree: Master");
        assertThat(criteria.get(8).label()).isEqualTo("Certification: AWS Solutions Architect");
    }

    @Test
    void lInfereCompteCommeLeDeclare() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {"requiredSkills": [
                  {"name": "Go", "weight": 4, "origin": "declared"},
                  {"name": "Rust", "weight": 4, "origin": "inferred"}
                ]}"""));

        assertThat(criteria).extracting(MatchingCriterion::section)
                .containsOnly(MatchingSection.REQUIRED_SKILLS);
        assertThat(criteria).extracting(MatchingCriterion::weight).containsExactly(4, 4);
    }

    @Test
    void ficheVideOuSectionsAbsentesNeDonnentAucunCritere() {
        assertThat(builder.build(json("{}"))).isEmpty();
        assertThat(builder.build(json("""
                {"requiredSkills": [], "preferredSkills": null, "languages": "x", "requiredYears": null,
                 "requiredDegrees": [], "certifications": []}"""))).isEmpty();
    }

    @Test
    void entreesSansNomEtPoidsInvalidesSontToleres() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {
                  "requiredSkills": [
                    {"name": "  ", "weight": 5},
                    {"weight": 5},
                    {"name": "SQL"},
                    {"name": "Docker", "weight": 9},
                    {"name": "Linux", "weight": "high"}
                  ],
                  "languages": [{"level": "B2"}],
                  "requiredYears": "five",
                  "requiredDegrees": [{"label": ""}]
                }"""));

        assertThat(criteria).extracting(MatchingCriterion::key).containsExactly("skill:sql", "skill:docker",
                "skill:linux");
        // Poids absent, hors 1-5 ou non numérique → repli 1 (vieille fiche).
        assertThat(criteria).extracting(MatchingCriterion::weight).containsExactly(1, 1, 1);
    }

    @Test
    void lesClesRestentUniquesEtDistinctesPourLesSymboles() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {
                  "requiredSkills": [{"name": "C++", "weight": 3}, {"name": "C#", "weight": 3}, {"name": "C"}],
                  "preferredSkills": [{"name": "Java"}, {"name": "java"}],
                  "requiredDegrees": [{"label": "Ingénieur Télécom"}]
                }"""));

        assertThat(criteria).extracting(MatchingCriterion::key).containsExactly("skill:c-plus-plus",
                "skill:c-sharp", "skill:c", "skill:java", "skill:java-2", "degree:ingenieur-telecom");
    }

    @Test
    void slugSansCaractereUtileDevientItem() {
        Set<String> used = new HashSet<>();
        assertThat(MatchingCriteriaBuilder.uniqueKey(used, "skill", "!!!")).isEqualTo("skill:item");
        assertThat(MatchingCriteriaBuilder.uniqueKey(used, "skill", "???")).isEqualTo("skill:item-2");
        assertThat(MatchingCriteriaBuilder.slug("  Node.js / Express ")).isEqualTo("node-js-express");
    }

    private JsonNode json(String text) {
        return objectMapper.readTree(text);
    }
}
