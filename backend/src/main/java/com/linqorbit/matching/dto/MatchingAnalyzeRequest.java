package com.linqorbit.matching.dto;

import java.util.List;

import tools.jackson.databind.JsonNode;

/**
 * Appel {@code POST /matching/analyze} du service IA (D58) : tout le contexte,
 * à chaque appel — le service IA ne garde rien. Les fiches partent telles que
 * stockées ; les critères sans leur poids (le LLM ne pondère jamais).
 * {@code matchingId} ne sert côté IA qu'à regrouper les traces LangSmith.
 */
public record MatchingAnalyzeRequest(
        String matchingId,
        JsonNode candidate,
        JsonNode offer,
        List<MatchingCriterionPayload> criteria) {
}
