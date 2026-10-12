package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Compétence exigée par une offre vue dans une réponse : type d'exigence,
 * poids, années d'expérience et nom de la compétence (résolu depuis le
 * vocabulaire pour l'affichage).
 */
public record JobOfferSkillOption(
        UUID skillId,
        String name,
        String requirementType,
        Integer weight,
        Integer yearsExperience) {
}
