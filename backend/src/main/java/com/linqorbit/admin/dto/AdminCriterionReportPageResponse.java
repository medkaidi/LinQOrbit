package com.linqorbit.admin.dto;

import java.util.List;

/**
 * Page de la liste des signalements internes d'évaluations IA (T-86, D66) :
 * enveloppe stable (pas de type Page de Spring dans le JSON) — {@code page}
 * 0-based, {@code total} = nombre total de signalements.
 */
public record AdminCriterionReportPageResponse(
        List<AdminCriterionReportResponse> items,
        int page,
        int size,
        long total) {
}
