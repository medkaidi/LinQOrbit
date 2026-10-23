package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Avis final de l'administrateur courant sur un signalement d'évaluation IA
 * (T-96, D77/D78). Seul cet avis est exposé : jamais la liste des avis, jamais
 * un compteur, jamais l'existence d'avis d'autrui.
 *
 * @param id                 identifiant de la revue
 * @param verdict            {@code upheld} ou {@code notUpheld}
 * @param note               note libre facultative
 * @param correctedScore     score corrigé facultatif (uniquement si {@code upheld})
 * @param correctedRationale justification corrigée facultative (uniquement si {@code upheld})
 * @param createdAt          date de création, immuable
 */
public record AdminCriterionReportReviewResponse(
        UUID id,
        String verdict,
        String note,
        Integer correctedScore,
        String correctedRationale,
        LocalDateTime createdAt) {
}
