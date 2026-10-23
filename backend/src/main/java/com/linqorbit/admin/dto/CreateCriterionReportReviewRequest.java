package com.linqorbit.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Création de la revue finale d'un signalement d'évaluation IA (T-96,
 * D77/D78). L'avis est définitif : aucun endpoint de mise à jour ou de
 * suppression n'existe.
 *
 * @param verdict            {@code upheld} (signalement valide, score IA à
 *                           corriger) ou {@code notUpheld} (score IA maintenu)
 * @param note               note libre facultative, 2 000 caractères maximum
 * @param correctedScore     score corrigé facultatif, 0–100, uniquement si
 *                           {@code upheld}
 * @param correctedRationale justification corrigée facultative, 2 000
 *                           caractères maximum, uniquement si {@code upheld}
 */
public record CreateCriterionReportReviewRequest(
        @NotBlank(message = "must not be blank")
        String verdict,

        @Size(max = 2000, message = "must not exceed 2000 characters")
        String note,

        @Min(value = 0, message = "must be between 0 and 100")
        @Max(value = 100, message = "must be between 0 and 100")
        Integer correctedScore,

        @Size(max = 2000, message = "must not exceed 2000 characters")
        String correctedRationale) {
}
