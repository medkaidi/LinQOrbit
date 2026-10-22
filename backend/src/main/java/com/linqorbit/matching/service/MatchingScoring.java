package com.linqorbit.matching.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import com.linqorbit.matching.exception.InvalidMatchingAnalysisException;

/**
 * Barème du matching (D58), côté backend : le LLM produit un score 0-100 par
 * critère, ce composant contrôle l'analyse (couverture exacte des clés,
 * bornes) puis calcule le score de chaque section = moyenne pondérée de ses
 * critères (un critère absent de la fiche candidat vaut 0 — il est scoré 0
 * par l'agent). Aucune compensation entre sections (§7.1), aucun signal ni
 * éviction (§12.1).
 *
 * <p>Seul module de calcul à remplacer quand la politique définitive sera
 * fixée : bumper {@link #SCORING_VERSION}, enregistrée dans chaque résultat
 * avec la {@code policyVersion} de l'agent.</p>
 */
@Component
@RequiredArgsConstructor
public class MatchingScoring {

    /** Format du JSON {@code matching_result.result} (colonne schema_version). */
    public static final String RESULT_SCHEMA_VERSION = "1";
    /** Barème provisoire : moyenne pondérée par section. */
    public static final String SCORING_VERSION = "weighted-1";

    private final ObjectMapper objectMapper;

    /**
     * Compose le JSON du résultat à partir des critères envoyés et de
     * l'analyse renvoyée par l'agent.
     *
     * @throws InvalidMatchingAnalysisException analyse incomplète, en trop ou hors bornes
     */
    public ObjectNode score(List<MatchingCriterion> criteria, JsonNode analysis) {
        Map<String, JsonNode> assessments = indexAssessments(analysis);
        Set<String> expected = new HashSet<>();
        criteria.forEach(criterion -> expected.add(criterion.key()));
        List<String> unexpected = assessments.keySet().stream().filter(key -> !expected.contains(key)).sorted()
                .toList();
        if (!unexpected.isEmpty()) {
            throw new InvalidMatchingAnalysisException("AI analysis scored unknown criteria: " + unexpected);
        }

        Map<MatchingSection, ArrayNode> criteriaBySection = new LinkedHashMap<>();
        Map<MatchingSection, long[]> totals = new HashMap<>();
        for (MatchingCriterion criterion : criteria) {
            JsonNode assessment = assessments.get(criterion.key());
            if (assessment == null) {
                throw new InvalidMatchingAnalysisException("AI analysis missed criterion: " + criterion.key());
            }
            int score = scoreOf(criterion.key(), assessment);
            ObjectNode item = objectMapper.createObjectNode();
            item.put("key", criterion.key());
            item.put("label", criterion.label());
            if (criterion.requirement() == null) {
                item.putNull("requirement");
            } else {
                item.put("requirement", criterion.requirement());
            }
            item.put("weight", criterion.weight());
            item.put("score", score);
            item.put("rationale", assessment.path("rationale").asString(""));
            item.set("evidence", assessment.path("evidence").isArray()
                    ? assessment.path("evidence")
                    : objectMapper.createArrayNode());
            criteriaBySection.computeIfAbsent(criterion.section(), key -> objectMapper.createArrayNode()).add(item);
            long[] sums = totals.computeIfAbsent(criterion.section(), key -> new long[2]);
            sums[0] += (long) criterion.weight() * score;
            sums[1] += criterion.weight();
        }

        ObjectNode result = objectMapper.createObjectNode();
        result.put("schemaVersion", RESULT_SCHEMA_VERSION);
        result.put("policyVersion", analysis.path("policyVersion").asString(""));
        result.put("scoringVersion", SCORING_VERSION);
        ArrayNode sections = result.putArray("sections");
        for (MatchingSection section : MatchingSection.values()) {
            ArrayNode items = criteriaBySection.get(section);
            if (items == null) {
                continue;
            }
            long[] sums = totals.get(section);
            ObjectNode node = sections.addObject();
            node.put("section", section.getStorageValue());
            node.put("score", weightedAverage(sums[0], sums[1]));
            node.set("criteria", items);
        }
        return result;
    }

    private static Map<String, JsonNode> indexAssessments(JsonNode analysis) {
        JsonNode list = analysis == null ? null : analysis.path("assessments");
        if (list == null || !list.isArray()) {
            throw new InvalidMatchingAnalysisException("AI analysis has no assessments array");
        }
        Map<String, JsonNode> byKey = new HashMap<>();
        for (JsonNode assessment : list) {
            String key = assessment.path("criterionKey").asString("");
            if (key.isBlank() || byKey.put(key, assessment) != null) {
                throw new InvalidMatchingAnalysisException("AI analysis has a blank or duplicate criterion key");
            }
        }
        return byKey;
    }

    /**
     * Score 0–100 du critère, cohérent avec ses preuves (D61) : un score de 0
     * n'a aucune preuve, un score positif en a au moins une — sinon l'analyse
     * est inexploitable (retry du worker, jamais de résultat incohérent écrit).
     */
    private static int scoreOf(String key, JsonNode assessment) {
        JsonNode score = assessment.path("score");
        if (!score.isIntegralNumber() || score.asInt() < 0 || score.asInt() > 100) {
            throw new InvalidMatchingAnalysisException("AI analysis gave an invalid score for criterion: " + key);
        }
        JsonNode evidence = assessment.path("evidence");
        boolean hasEvidence = evidence.isArray() && !evidence.isEmpty();
        if (score.asInt() == 0 && hasEvidence) {
            throw new InvalidMatchingAnalysisException("AI analysis gave evidence to a zero score for criterion: " + key);
        }
        if (score.asInt() > 0 && !hasEvidence) {
            throw new InvalidMatchingAnalysisException("AI analysis gave no evidence to a positive score for criterion: "
                    + key);
        }
        return score.asInt();
    }

    /** Moyenne pondérée arrondie au dixième (demi vers le haut). */
    static double weightedAverage(long weightedSum, long totalWeight) {
        return BigDecimal.valueOf(weightedSum)
                .divide(BigDecimal.valueOf(totalWeight), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
