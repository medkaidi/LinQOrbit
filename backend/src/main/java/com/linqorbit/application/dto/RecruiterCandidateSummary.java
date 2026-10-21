package com.linqorbit.application.dto;

/**
 * Identité minimale du candidat dans la liste recruteur : prénom et nom
 * uniquement — jamais l'email, le téléphone ou le profil brut.
 */
public record RecruiterCandidateSummary(
        String firstName,
        String lastName) {
}
