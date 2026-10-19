package com.linqorbit.matching.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Contestation d'un critère (T-63) : clé stable du critère, score propre
 * 0–100 obligatoire, commentaire texte facultatif (trimé côté service, vide
 * → absent, 2000 caractères au plus une fois trimé).
 */
public record MatchingFeedbackItemRequest(
        @NotBlank(message = "must not be blank") @Size(max = 200, message = "must be at most 200 characters") String criterionKey,
        @NotNull(message = "must not be null") @Min(value = 0, message = "must be at least 0") @Max(value = 100, message = "must be at most 100") Integer selfValue,
        String comment) {
}
