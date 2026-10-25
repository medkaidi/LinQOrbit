package com.linqorbit.invitation.dto;

import java.util.List;
import java.util.UUID;

/**
 * Carte d'un candidat suggéré pour une offre (T-101, D85 ; identité T-102, D86).
 * Le candidat a <b>consenti</b> à ce que les recruteurs voient son profil
 * complet : la carte porte donc son nom. {@code id} reste l'id de la ligne
 * propre à l'offre — jamais l'id du candidat ni celui de sa fiche. Jamais
 * d'e-mail ni de téléphone : le contact passe par l'invitation dans la
 * plateforme.
 *
 * @param rank   rang dans le Top N du screening, à partir de 1
 * @param status {@code suggested}, {@code invited}, ou {@code applied} (le
 *               candidat a candidaté à l'offre : dérivé de la candidature)
 */
public record SuggestedCandidateCard(
        UUID id,
        int rank,
        String firstName,
        String lastName,
        String title,
        String seniority,
        Integer yearsOfExperience,
        String country,
        List<SuggestedSkill> skills,
        String status) {
}
