package com.linqorbit.application.dto;

/**
 * Critère du matching côté recruteur : score et justification IA. Les preuves
 * internes (index de fiche) ne sortent pas.
 */
public record RecruiterCriterionView(
        String key,
        String label,
        String requirement,
        int weight,
        int score,
        String rationale) {
}
