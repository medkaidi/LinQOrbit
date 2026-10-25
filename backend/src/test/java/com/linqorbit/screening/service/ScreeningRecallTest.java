package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class ScreeningRecallTest {

    private final UUID a = UUID.randomUUID();
    private final UUID b = UUID.randomUUID();
    private final UUID c = UUID.randomUUID();
    private final UUID d = UUID.randomUUID();
    private final UUID noise = UUID.randomUUID();

    @Test
    void recallIsTheShareOfRelevantCandidatesFoundInTheTopN() {
        List<UUID> ranked = List.of(a, noise, b, c, d);
        Set<UUID> relevant = Set.of(a, b, c, d);

        assertThat(ScreeningRecall.recallAt(ranked, relevant, 1)).isEqualTo(0.25);
        assertThat(ScreeningRecall.recallAt(ranked, relevant, 3)).isEqualTo(0.5);
        assertThat(ScreeningRecall.recallAt(ranked, relevant, 5)).isEqualTo(1.0);
    }

    @Test
    void aNLargerThanTheRankingOrNonPositiveIsHandled() {
        List<UUID> ranked = List.of(a, b);
        Set<UUID> relevant = Set.of(a, b, c);

        assertThat(ScreeningRecall.recallAt(ranked, relevant, 100)).isEqualTo(2.0 / 3.0);
        assertThat(ScreeningRecall.recallAt(ranked, relevant, 0)).isZero();
        assertThat(ScreeningRecall.recallAt(ranked, relevant, -3)).isZero();
        assertThat(ScreeningRecall.recallAt(List.of(), relevant, 5)).isZero();
    }

    @Test
    void anOfferWithoutRelevantCandidateIsNotMeasurable() {
        assertThat(ScreeningRecall.recallAt(List.of(a), Set.of(), 5)).isNaN();
    }

    @Test
    void hitMeansAtLeastOneRelevantCandidateInTheTopN() {
        List<UUID> ranked = List.of(noise, a);

        assertThat(ScreeningRecall.hitAt(ranked, Set.of(a), 1)).isFalse();
        assertThat(ScreeningRecall.hitAt(ranked, Set.of(a), 2)).isTrue();
        assertThat(ScreeningRecall.hitAt(ranked, Set.of(), 2)).isFalse();
    }

    @Test
    void meanAndMinIgnoreTheOffersThatAreNotMeasurable() {
        List<Double> values = List.of(1.0, Double.NaN, 0.5);

        assertThat(ScreeningRecall.mean(values)).isEqualTo(0.75);
        assertThat(ScreeningRecall.min(values)).isEqualTo(0.5);
        assertThat(ScreeningRecall.mean(List.of(Double.NaN))).isNaN();
        assertThat(ScreeningRecall.min(List.of())).isNaN();
    }
}
