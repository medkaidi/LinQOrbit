package com.linqorbit.matching.dto;

import java.util.List;
import java.util.UUID;

/**
 * Matching vu par le candidat (D58, D5 tranché) : statut de l'analyse
 * ({@code pending}, {@code running}, {@code done}, {@code failed}) et, une
 * fois terminée, chaque section avec le <b>score de chaque critère</b> —
 * rien d'autre : ni poids, ni provenance, ni score de section, ni
 * justification (réservés au recruteur, T-66). {@code sections} est vide tant
 * que l'analyse n'est pas terminée.
 */
public record MatchingResponse(
        UUID matchingId,
        String status,
        List<MatchingSectionView> sections) {
}
