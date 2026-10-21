package com.linqorbit.application.dto;

/**
 * Identité minimale du candidat dans la liste recruteur : prénom, nom et
 * intitulé du poste actuel — jamais l'email, le téléphone ou le profil brut.
 */
public record RecruiterCandidateSummary(
        String firstName,
        String lastName,
        String title) {
}
