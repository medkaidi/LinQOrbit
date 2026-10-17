package com.linqorbit.joboffer.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Option d'une question de choix (D47) : label (1–500), ordre (≥ 0) et
 * {@code preferred} — information recruteur seule (a choisi / n'a pas choisi
 * l'option préférée), absent → false. Aucun poids.
 */
public record JobOfferQuestionOptionRequest(
        @NotBlank(message = "must not be blank") @Size(max = 500, message = "must be at most 500 characters") String label,
        @NotNull(message = "must not be null") @Min(value = 0, message = "must be at least 0") Integer sortOrder,
        Boolean preferred) {
}
