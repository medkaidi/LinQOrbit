package com.linqorbit.matching.service;

/**
 * Critère extrait de la fiche offre (D58) : clé stable ({@code criterion_key},
 * contrat D54), section, libellé, attente de l'offre en texte (envoyée à
 * l'agent) et poids (jamais envoyé à l'agent — le calcul reste backend).
 */
public record MatchingCriterion(
        String key,
        MatchingSection section,
        String label,
        String requirement,
        int weight) {
}
