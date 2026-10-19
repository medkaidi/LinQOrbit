package com.linqorbit.matching.dto;

import java.util.List;

import tools.jackson.databind.JsonNode;

/**
 * Appel {@code POST /matching/analyze} du service IA (D58) : tout le contexte,
 * à chaque appel — le service IA ne garde rien. Les fiches partent telles que
 * stockées ; les critères sans leur poids (le LLM ne pondère jamais).
 * {@code matchingId} ne sert côté IA qu'à regrouper les traces LangSmith.
 * Dès la réévaluation (T-62) : les évaluations du résultat précédent (clé,
 * score, justification, preuves — jamais de poids) et toutes les
 * clarifications fermées dans l'ordre d'ajout (les index de preuve
 * {@code clarification} restent ainsi stables d'un tour à l'autre).
 */
public record MatchingAnalyzeRequest(
        String matchingId,
        JsonNode candidate,
        JsonNode offer,
        List<MatchingCriterionPayload> criteria,
        List<JsonNode> previousAssessments,
        List<ClarificationHistoryPayload> clarifications) {
}
