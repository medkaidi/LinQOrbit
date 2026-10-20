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
 * poids (fiche pour les compétences, 1 sinon), clés stables, un critère
 * éducation conjoint (D67) et tolérance aux champs absents, vides ou
 * invalides.
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
                "experience:total", "education:requirement", "certification:aws-solutions-architect");
        assertThat(criteria).extracting(MatchingCriterion::section).containsExactly(
                MatchingSection.REQUIRED_SKILLS, MatchingSection.REQUIRED_SKILLS, MatchingSection.PREFERRED_SKILLS,
                MatchingSection.LANGUAGES, MatchingSection.LANGUAGES, MatchingSection.EXPERIENCE,
                MatchingSection.EDUCATION, MatchingSection.EDUCATION);
        // Compétences : poids de la fiche ; tout le reste, langues et éducation comprises : 1.
        assertThat(criteria).extracting(MatchingCriterion::weight).containsExactly(5, 3, 2, 1, 1, 1, 1, 1);
        assertThat(criteria.get(0).requirement()).isEqualTo("level 4/5, at least 3 years");
        assertThat(criteria.get(1).requirement()).isNull();
        assertThat(criteria.get(3).requirement()).isEqualTo("CEFR C1, required");
        assertThat(criteria.get(4).requirement()).isEqualTo("Any level, nice to have");
        assertThat(criteria.get(5).requirement())
                .isEqualTo("At least 5 years of experience relevant to this role");
        // Formation : un seul critère conjoint, degré et domaine ; la certification reste séparée.
        assertThat(criteria.get(6).label()).isEqualTo("Education");
        assertThat(criteria.get(6).requirement())
                .isEqualTo("Degree level (one of, or above): Master; Field of study (one of): Computer Science");
        assertThat(criteria.get(7).label()).isEqualTo("Certification: AWS Solutions Architect");
        assertThat(criteria.get(7).requirement()).isNull();
        // D68 : métadonnées structurées sur la formation seule, jamais sur une certification.
        assertThat(criteria.get(6).education())
                .isEqualTo(new MatchingEducation(List.of("Master"), List.of(), List.of("Computer Science")));
        assertThat(criteria.get(7).education()).isNull();
        assertThat(criteria.subList(0, 6)).extracting(MatchingCriterion::education).containsOnlyNulls();
    }

    @Test
    void degresSeulsDonnentUnCritereEducationSansDomaine() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {"requiredDegrees": [{"label": "Bachelor's degree"}, {"label": "Master's degree"}]}"""));

        assertThat(criteria).singleElement().satisfies(criterion -> {
            assertThat(criterion.key()).isEqualTo("education:requirement");
            assertThat(criterion.section()).isEqualTo(MatchingSection.EDUCATION);
            assertThat(criterion.weight()).isEqualTo(1);
            // Alternatives de la dimension, dans l'ordre de la fiche.
            assertThat(criterion.requirement())
                    .isEqualTo("Degree level (one of, or above): Bachelor's degree, Master's degree");
            assertThat(criterion.education()).isEqualTo(
                    new MatchingEducation(List.of("Bachelor's degree", "Master's degree"), List.of(), List.of()));
        });
    }

    @Test
    void domainesSeulsDonnentUnCritereEducationSansNiveau() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {"requiredStudyFields": [{"label": "Computer Science"}, {"label": "Software Engineering"}]}"""));

        assertThat(criteria).singleElement().satisfies(criterion -> {
            assertThat(criterion.key()).isEqualTo("education:requirement");
            assertThat(criterion.requirement())
                    .isEqualTo("Field of study (one of): Computer Science, Software Engineering")
                    .doesNotContain("Degree level");
            assertThat(criterion.education()).isEqualTo(
                    new MatchingEducation(List.of(), List.of(), List.of("Computer Science", "Software Engineering")));
        });
    }

    @Test
    void professionalCertificateEstUnCredentialJamaisUnNiveau() {
        List<MatchingCriterion> credentialOnly = builder.build(json("""
                {"requiredDegrees": [{"label": " professional CERTIFICATE "}],
                 "requiredStudyFields": [{"label": "Computer Science"}]}"""));

        assertThat(credentialOnly).singleElement().extracting(MatchingCriterion::requirement)
                .isEqualTo("Credential (one of): professional CERTIFICATE; Field of study (one of): Computer Science");
        // Le credential n'entre jamais dans les niveaux de diplôme.
        assertThat(credentialOnly.get(0).education()).isEqualTo(
                new MatchingEducation(List.of(), List.of("professional CERTIFICATE"), List.of("Computer Science")));

        List<MatchingCriterion> mixed = builder.build(json("""
                {"requiredDegrees": [{"label": "Professional certificate"}, {"label": "Master"}],
                 "requiredStudyFields": [{"label": "Computer Science"}]}"""));

        // Ordre fixe des parties : niveau, credential, domaine.
        assertThat(mixed).singleElement().extracting(MatchingCriterion::requirement).isEqualTo(
                "Degree level (one of, or above): Master; Credential (one of): Professional certificate;"
                        + " Field of study (one of): Computer Science");
        assertThat(mixed.get(0).education()).isEqualTo(new MatchingEducation(
                List.of("Master"), List.of("Professional certificate"), List.of("Computer Science")));

        List<MatchingCriterion> credentialAlone = builder.build(json("""
                {"requiredDegrees": [{"label": "Professional certificate"}]}"""));
        assertThat(credentialAlone).singleElement().extracting(MatchingCriterion::education)
                .isEqualTo(new MatchingEducation(List.of(), List.of("Professional certificate"), List.of()));
    }

    @Test
    void sansDiplomeNiDomaineExploitableAucunCritereEducation() {
        assertThat(builder.build(json("{}"))).isEmpty();
        assertThat(builder.build(json("""
                {"requiredDegrees": [], "requiredStudyFields": []}"""))).isEmpty();
        assertThat(builder.build(json("""
                {"requiredDegrees": [{"label": "  "}, {"label": null}, {}],
                 "requiredStudyFields": [{"label": ""}], "certifications": [{"name": "CKA"}]}""")))
                .extracting(MatchingCriterion::key).containsExactly("certification:cka");
    }

    @Test
    void lesLabelsEnDoubleNApparaissentQuUneFois() {
        List<MatchingCriterion> criteria = builder.build(json("""
                {"requiredDegrees": [{"label": "Master"}, {"label": " master "}, {"label": "MASTER"}],
                 "requiredStudyFields": [{"label": "Computer  Science"}, {"label": "computer science"}]}"""));

        assertThat(criteria).singleElement().extracting(MatchingCriterion::requirement)
                .isEqualTo("Degree level (one of, or above): Master; Field of study (one of): Computer  Science");
        assertThat(criteria.get(0).education())
                .isEqualTo(new MatchingEducation(List.of("Master"), List.of(), List.of("Computer  Science")));
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
                "skill:c-sharp", "skill:c", "skill:java", "skill:java-2", "education:requirement");
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
