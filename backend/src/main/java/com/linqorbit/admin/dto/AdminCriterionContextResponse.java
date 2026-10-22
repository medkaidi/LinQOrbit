package com.linqorbit.admin.dto;

import java.util.UUID;

/**
 * Critère signalé, relu dans le résultat épinglé (T-86, D66) : score,
 * score de section, exigence et justification IA. {@code resolved} est faux
 * si la clé n'existe plus dans le JSON — la page affiche alors le signalement
 * sans contexte de score, jamais une note inventée.
 */
public record AdminCriterionContextResponse(
        String key,
        String label,
        String section,
        Integer score,
        Double sectionScore,
        String requirement,
        String rationale,
        boolean resolved) {
}
