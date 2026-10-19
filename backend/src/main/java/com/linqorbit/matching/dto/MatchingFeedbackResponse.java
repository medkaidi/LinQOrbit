package com.linqorbit.matching.dto;

import java.util.List;

/** Contestations enregistrées, triées par clé de critère. */
public record MatchingFeedbackResponse(List<MatchingFeedbackView> items) {
}
