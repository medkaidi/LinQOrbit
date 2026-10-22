package com.linqorbit.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Signalement interne d'une évaluation IA (T-86, D66).
 *
 * @param criterionKey clé du critère dans le résultat affiché (recopiée
 *                    verbatim par le client, jamais recalculée)
 * @param reason       motif : scoreIncorrect, evidenceWrong,
 *                    profileMisunderstood, requirementMisunderstood, other
 * @param comment      commentaire facultatif — **obligatoire** pour le motif
 *                    « other », seul motif qui ne dit rien par lui-même
 */
public record CriterionReportRequest(
        @NotBlank(message = "must not be blank")
        @Size(max = 200, message = "must not exceed 200 characters")
        String criterionKey,

        @NotBlank(message = "must not be blank")
        String reason,

        @Size(max = 2000, message = "must not exceed 2000 characters")
        String comment) {
}
