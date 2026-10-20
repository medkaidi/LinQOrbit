package com.linqorbit.matching.service;

/**
 * Critère extrait de la fiche offre (D58) : clé stable ({@code criterion_key},
 * contrat D54), section, libellé, attente de l'offre en texte (envoyée à
 * l'agent) et poids (jamais envoyé à l'agent — le calcul reste backend).
 * {@code education} porte l'exigence de formation structurée du seul critère
 * {@code education:requirement} (D68) ; {@code null} pour tout autre critère.
 */
public record MatchingCriterion(
        String key,
        MatchingSection section,
        String label,
        String requirement,
        int weight,
        MatchingEducation education) {

    /** Critère sans exigence de formation (compétences, langues, expérience, certifications). */
    public MatchingCriterion(String key, MatchingSection section, String label, String requirement, int weight) {
        this(key, section, label, requirement, weight, null);
    }
}
