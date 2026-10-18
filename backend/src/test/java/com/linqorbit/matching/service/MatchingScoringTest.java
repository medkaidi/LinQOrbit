package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import com.linqorbit.matching.exception.InvalidMatchingAnalysisException;

/**
 * Barème backend (D58) : moyenne pondérée par section, absent = 0, aucune
 * compensation entre sections, contrôle strict de l'analyse IA.
 */
class MatchingScoringTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();
    private final MatchingScoring scoring = new MatchingScoring(objectMapper);

    private static final List<MatchingCriterion> CRITERIA = List.of(
            new MatchingCriterion("skill:java", MatchingSection.REQUIRED_SKILLS, "Java", "level 4/5", 5),
            new MatchingCriterion("skill:go", MatchingSection.REQUIRED_SKILLS, "Go", null, 1),
            new MatchingCriterion("skill:react", MatchingSection.PREFERRED_SKILLS, "React", null, 2),
            new MatchingCriterion("language:english", MatchingSection.LANGUAGES, "English", "CEFR C1, required", 1));

    @Test
    void moyennePondereeParSectionSansMelangeEtAbsentAZero() {
        ObjectNode result = scoring.score(CRITERIA, analysis("""
                [
                  {"criterionKey": "skill:java", "score": 80, "rationale": "Strong.", "evidence": [{"source": "skill", "index": 0}]},
                  {"criterionKey": "skill:go", "score": 0, "rationale": "Not shown.", "evidence": []},
                  {"criterionKey": "skill:react", "score": 50, "rationale": "Related."},
                  {"criterionKey": "language:english", "score": 100, "rationale": "C2."}
                ]"""));

        assertThat(result.path("schemaVersion").asString()).isEqualTo("1");
        assertThat(result.path("policyVersion").asString()).isEqualTo("generic-1");
        assertThat(result.path("scoringVersion").asString()).isEqualTo(MatchingScoring.SCORING_VERSION);
        JsonNode sections = result.path("sections");
        assertThat(sections).hasSize(3);
        // (5×80 + 1×0) / 6 = 66.67 → 66.7 : le Go absent pèse 0, sans compensation par les souhaitables.
        assertThat(sections.get(0).path("section").asString()).isEqualTo("required_skills");
        assertThat(sections.get(0).path("score").asDouble()).isEqualTo(66.7);
        assertThat(sections.get(1).path("section").asString()).isEqualTo("preferred_skills");
        assertThat(sections.get(1).path("score").asDouble()).isEqualTo(50.0);
        assertThat(sections.get(2).path("section").asString()).isEqualTo("languages");
        assertThat(sections.get(2).path("score").asDouble()).isEqualTo(100.0);

        JsonNode java = sections.get(0).path("criteria").get(0);
        assertThat(java.path("key").asString()).isEqualTo("skill:java");
        assertThat(java.path("weight").asInt()).isEqualTo(5);
        assertThat(java.path("score").asInt()).isEqualTo(80);
        assertThat(java.path("requirement").asString()).isEqualTo("level 4/5");
        assertThat(java.path("rationale").asString()).isEqualTo("Strong.");
        assertThat(java.path("evidence")).hasSize(1);
        JsonNode go = sections.get(0).path("criteria").get(1);
        assertThat(go.path("requirement").isNull()).isTrue();
        // Évidence absente → tableau vide, jamais null.
        assertThat(sections.get(1).path("criteria").get(0).path("evidence").isArray()).isTrue();
    }

    @Test
    void sectionSansCritereEstOmise() {
        ObjectNode result = scoring.score(List.of(CRITERIA.get(3)), analysis("""
                [{"criterionKey": "language:english", "score": 40, "rationale": "B1."}]"""));

        assertThat(result.path("sections")).hasSize(1);
        assertThat(result.path("sections").get(0).path("section").asString()).isEqualTo("languages");
    }

    @Test
    void arrondiAuDixiemeDemiVersLeHaut() {
        assertThat(MatchingScoring.weightedAverage(200, 3)).isEqualTo(66.7);
        assertThat(MatchingScoring.weightedAverage(1, 4)).isEqualTo(0.3);
        assertThat(MatchingScoring.weightedAverage(0, 7)).isEqualTo(0.0);
        assertThat(MatchingScoring.weightedAverage(700, 7)).isEqualTo(100.0);
    }

    @Test
    void analyseIncompleteEnTropOuDupliqueeEstRefusee() {
        assertInvalid(CRITERIA, """
                [{"criterionKey": "skill:java", "score": 80, "rationale": "r"}]""", "missed criterion");
        assertInvalid(List.of(CRITERIA.get(0)), """
                [{"criterionKey": "skill:java", "score": 80, "rationale": "r"},
                 {"criterionKey": "skill:rust", "score": 10, "rationale": "r"}]""", "unknown criteria");
        assertInvalid(List.of(CRITERIA.get(0)), """
                [{"criterionKey": "skill:java", "score": 80, "rationale": "r"},
                 {"criterionKey": "skill:java", "score": 70, "rationale": "r"}]""", "duplicate");
        assertInvalid(List.of(CRITERIA.get(0)), """
                [{"criterionKey": "", "score": 80, "rationale": "r"}]""", "blank");
    }

    @Test
    void scoreHorsBornesOuNonEntierEstRefuse() {
        for (String score : List.of("-1", "101", "50.5", "\"80\"", "null")) {
            assertInvalid(List.of(CRITERIA.get(0)),
                    "[{\"criterionKey\": \"skill:java\", \"score\": " + score + ", \"rationale\": \"r\"}]",
                    "invalid score");
        }
    }

    @Test
    void bornesInclusesSontAcceptees() {
        ObjectNode result = scoring.score(List.of(CRITERIA.get(0), CRITERIA.get(1)), analysis("""
                [{"criterionKey": "skill:java", "score": 100, "rationale": "r"},
                 {"criterionKey": "skill:go", "score": 0, "rationale": "r"}]"""));

        assertThat(result.path("sections").get(0).path("score").asDouble()).isEqualTo(83.3);
    }

    @Test
    void analyseSansTableauEstRefusee() {
        assertThatThrownBy(() -> scoring.score(CRITERIA, objectMapper.readTree("{\"policyVersion\": \"x\"}")))
                .isInstanceOf(InvalidMatchingAnalysisException.class);
        assertThatThrownBy(() -> scoring.score(CRITERIA, null))
                .isInstanceOf(InvalidMatchingAnalysisException.class);
    }

    private void assertInvalid(List<MatchingCriterion> criteria, String assessments, String reason) {
        assertThatThrownBy(() -> scoring.score(criteria, analysis(assessments)))
                .isInstanceOf(InvalidMatchingAnalysisException.class)
                .hasMessageContaining(reason);
    }

    private JsonNode analysis(String assessments) {
        return objectMapper.readTree("{\"schemaVersion\": \"1\", \"policyVersion\": \"generic-1\", \"assessments\": "
                + assessments + "}");
    }
}
