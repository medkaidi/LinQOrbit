package com.linqorbit.matching.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * Remplacement complet des contestations du candidat (T-63) : les items
 * absents sont supprimés, une liste vide efface tout.
 */
public record SaveMatchingFeedbackRequest(
        @NotNull(message = "must not be null") List<@NotNull(message = "must not be null") @Valid MatchingFeedbackItemRequest> items) {
}
