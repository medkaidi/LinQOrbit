package com.linqorbit.application.dto;

/**
 * Contestation candidate d'un critère : score propre, score IA du résultat
 * contesté et écart absolu. C'est un signal de désaccord, jamais un score de
 * qualité candidat.
 */
public record RecruiterContestationView(
        String criterionKey,
        String label,
        int aiScore,
        int selfValue,
        double gap,
        String comment) {
}
