package com.linqorbit.application.dto;

import java.util.List;

import com.linqorbit.invitation.dto.SuggestedSkill;

/**
 * Repères du candidat sur la carte de la liste recruteur : séniorité, années
 * d'expérience, pays et compétences principales, tirés de sa dernière fiche
 * normalisée (même liste blanche que la carte d'un candidat suggéré) ; années
 * et pays se replient sur ceux déclarés au profil. Jamais de ville, de
 * salaire ni de coordonnées. Champs {@code null} / liste vide quand la donnée
 * n'existe pas.
 */
public record RecruiterCandidateHighlights(
        String seniority,
        Integer yearsOfExperience,
        String country,
        List<SuggestedSkill> skills) {
}
