package com.linqorbit.matching.dto;

/** Contestation du candidat sur un critère (T-63) : son score propre et son commentaire. */
public record MatchingFeedbackView(
        String criterionKey,
        int selfValue,
        String comment) {
}
