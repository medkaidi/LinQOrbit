package com.linqorbit.matching.dto;

/**
 * Critère tel qu'envoyé à l'agent : clé stable à recopier, section, libellé
 * et attente de l'offre. Jamais le poids. {@code education} : exigence de
 * formation structurée du seul critère {@code education:requirement} (D68),
 * notée en code par le service IA ; {@code null} ailleurs.
 */
public record MatchingCriterionPayload(
        String key,
        String section,
        String label,
        String requirement,
        MatchingEducationPayload education) {

    /** Critère sans exigence de formation. */
    public MatchingCriterionPayload(String key, String section, String label, String requirement) {
        this(key, section, label, requirement, null);
    }
}
