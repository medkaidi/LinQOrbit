package com.linqorbit.matching.dto;

import java.util.List;
import java.util.UUID;

/**
 * Matching vu par le candidat (D58, D5 tranché) : statut de la dernière
 * analyse ({@code pending}, {@code running}, {@code done}, {@code failed}) et
 * le <b>score de chaque critère</b> du dernier résultat terminé, par section —
 * rien d'autre : ni poids, ni provenance, ni score de section, ni
 * justification (réservés au recruteur, T-66). Pendant une réévaluation, les
 * scores précédents restent affichés ; {@code sections} n'est vide qu'avant
 * la première analyse terminée. T-62 : la question IA ouverte (avec son
 * rationale destiné au candidat) et la fin d'évaluation ; T-63 : les
 * contestations du candidat lui-même.
 */
public record MatchingResponse(
        UUID matchingId,
        String status,
        List<MatchingSectionView> sections,
        boolean assessmentFinished,
        MatchingClarificationView clarification,
        List<MatchingFeedbackView> feedback) {
}
