package com.linqorbit.matching.dto;

import java.util.List;

import tools.jackson.databind.JsonNode;

/**
 * Appel {@code POST /matching/clarify} du service IA (T-62, D52–D53) : les
 * fiches, les critères, les évaluations qui viennent d'être produites, tout
 * l'historique des clarifications et le budget restant de questions.
 */
public record MatchingClarifyRequest(
        String matchingId,
        JsonNode candidate,
        JsonNode offer,
        List<MatchingCriterionPayload> criteria,
        List<JsonNode> assessments,
        List<ClarificationHistoryPayload> clarifications,
        int remainingQuestions) {
}
