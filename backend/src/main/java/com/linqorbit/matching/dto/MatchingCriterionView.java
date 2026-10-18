package com.linqorbit.matching.dto;

/** Critère côté candidat : clé stable, libellé et score 0-100 — rien d'autre (D58). */
public record MatchingCriterionView(
        String key,
        String label,
        int score) {
}
