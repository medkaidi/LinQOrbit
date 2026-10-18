package com.linqorbit.matching.dto;

import java.util.List;

/** Section du matching côté candidat : ses critères et leur score, sans score de section. */
public record MatchingSectionView(
        String section,
        List<MatchingCriterionView> criteria) {
}
