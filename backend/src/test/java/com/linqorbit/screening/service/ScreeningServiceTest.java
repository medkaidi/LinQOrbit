package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.linqorbit.embedding.service.EmbeddingSettings;
import com.linqorbit.embedding.service.ProfileTextRenderer;
import com.linqorbit.screening.dto.ScreenedCandidate;
import com.linqorbit.screening.repository.ScreeningRepository;

/**
 * Règles d'appel du screening : bornes de N, couple actif, statut exclu. Le SQL
 * lui-même se valide sur PostgreSQL réel ({@code ScreeningIntegrationTest}) ;
 * ici on épingle ce que le service transmet à la requête.
 */
class ScreeningServiceTest {

    private static final int NOT_LOOKING_CODE = 3;

    private final ScreeningRepository repository = mock(ScreeningRepository.class);
    private final EmbeddingSettings settings = new EmbeddingSettings("model", "7");
    private final UUID offerId = UUID.randomUUID();

    private ScreeningService service(int configuredTopN) {
        return new ScreeningService(repository, settings, configuredTopN);
    }

    private void theRepositoryAnswersNothing() {
        when(repository.findTopCandidates(any(), anyString(), anyString(), anyString(), anyInt(), anyInt()))
                .thenReturn(List.of());
    }

    private static UUID any() {
        return org.mockito.ArgumentMatchers.any(UUID.class);
    }

    @Test
    void theQueryReceivesTheActivePairAndTheExcludedStatus() {
        theRepositoryAnswersNothing();

        service(20).topCandidates(offerId, 5);

        verify(repository).findTopCandidates(offerId, "model", "7", ProfileTextRenderer.STRATEGY_VERSION,
                NOT_LOOKING_CODE, 5);
    }

    @Test
    void theConfiguredNIsUsedWhenNoneIsGiven() {
        theRepositoryAnswersNothing();

        service(12).topCandidates(offerId);

        verify(repository).findTopCandidates(eq(offerId), anyString(), anyString(), anyString(), anyInt(), eq(12));
    }

    @Test
    void aConfiguredNBelowOneIsRaisedToOneNeverEmptyNeverUnbounded() {
        theRepositoryAnswersNothing();

        service(0).topCandidates(offerId);
        service(-4).topCandidates(offerId);

        verify(repository, org.mockito.Mockito.times(2))
                .findTopCandidates(eq(offerId), anyString(), anyString(), anyString(), anyInt(), eq(1));
    }

    @Test
    void aConfiguredNAboveTheCeilingIsCappedAtTheCeiling() {
        theRepositoryAnswersNothing();

        service(10_000).topCandidates(offerId);

        verify(repository).findTopCandidates(eq(offerId), anyString(), anyString(), anyString(), anyInt(),
                eq(ScreeningService.MAX_TOP_N));
    }

    @Test
    void anExplicitNIsCappedAtTheCeilingAndTheCeilingItselfIsAccepted() {
        theRepositoryAnswersNothing();

        service(20).topCandidates(offerId, ScreeningService.MAX_TOP_N + 1);
        service(20).topCandidates(offerId, ScreeningService.MAX_TOP_N);
        service(20).topCandidates(offerId, Integer.MAX_VALUE);

        verify(repository, org.mockito.Mockito.times(3))
                .findTopCandidates(eq(offerId), anyString(), anyString(), anyString(), anyInt(),
                        eq(ScreeningService.MAX_TOP_N));
    }

    @Test
    void aNOfOneIsPassedAsIs() {
        theRepositoryAnswersNothing();

        service(20).topCandidates(offerId, 1);

        verify(repository).findTopCandidates(eq(offerId), anyString(), anyString(), anyString(), anyInt(), eq(1));
    }

    @Test
    void aNOfZeroIsEmptyWithoutAnyQuery() {
        assertThat(service(20).topCandidates(offerId, 0)).isEmpty();

        verify(repository, never()).findTopCandidates(any(), anyString(), anyString(), anyString(), anyInt(),
                anyInt());
    }

    @Test
    void aNegativeNIsACallerError() {
        assertThatThrownBy(() -> service(20).topCandidates(offerId, -1))
                .isInstanceOf(IllegalArgumentException.class);

        verify(repository, never()).findTopCandidates(any(), anyString(), anyString(), anyString(), anyInt(),
                anyInt());
    }

    @Test
    void rowsBecomeScreenedCandidatesInTheOrderOfTheQuery() {
        UUID firstCandidate = UUID.randomUUID();
        UUID secondCandidate = UUID.randomUUID();
        UUID firstFiche = UUID.randomUUID();
        UUID secondFiche = UUID.randomUUID();
        // Les lignes se construisent avant le stub : un when() imbriqué casserait le stubbing en cours.
        ScreeningRepository.Row first = row(firstCandidate, firstFiche, 0.1);
        ScreeningRepository.Row second = row(secondCandidate, secondFiche, 0.4);
        when(repository.findTopCandidates(any(), anyString(), anyString(), anyString(), anyInt(), anyInt()))
                .thenReturn(List.of(first, second));

        List<ScreenedCandidate> top = service(20).topCandidates(offerId);

        assertThat(top).containsExactly(new ScreenedCandidate(firstCandidate, firstFiche, 0.1),
                new ScreenedCandidate(secondCandidate, secondFiche, 0.4));
    }

    @Test
    void theResultIsNeverNullWhenNothingMatches() {
        theRepositoryAnswersNothing();

        assertThat(service(20).topCandidates(offerId)).isNotNull().isEmpty();
    }

    private static ScreeningRepository.Row row(UUID candidateId, UUID profileId, double distance) {
        ScreeningRepository.Row row = mock(ScreeningRepository.Row.class);
        when(row.getCandidateId()).thenReturn(candidateId);
        when(row.getNormalizedProfileId()).thenReturn(profileId);
        when(row.getDistance()).thenReturn(distance);
        return row;
    }
}
