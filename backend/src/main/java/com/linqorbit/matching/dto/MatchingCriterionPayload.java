package com.linqorbit.matching.dto;

/**
 * Critère tel qu'envoyé à l'agent : clé stable à recopier, section, libellé
 * et attente de l'offre. Jamais le poids.
 */
public record MatchingCriterionPayload(
        String key,
        String section,
        String label,
        String requirement) {
}
