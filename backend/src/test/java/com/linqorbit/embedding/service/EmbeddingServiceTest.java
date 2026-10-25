package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.embedding.entity.EmbeddingJob;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;

/**
 * Création des jobs et résilience : une panne d'embedding ne remonte jamais
 * au worker de normalisation, le backfill s'arrête quand plus rien ne manque.
 */
class EmbeddingServiceTest {

    private final EmbeddingJobRepository jobRepository = mock(EmbeddingJobRepository.class);
    private final EmbeddingSettings settings = new EmbeddingSettings("model", "1");
    private final EmbeddingWorker worker = mock(EmbeddingWorker.class);
    private final TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);
    private final EmbeddingService service =
            new EmbeddingService(jobRepository, settings, worker, transactionTemplate, 2, false);

    @SuppressWarnings("unchecked")
    private void transactionsRunInline() {
        when(transactionTemplate.execute(any())).thenAnswer(
                inv -> ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(null));
    }

    private EmbeddingJob job(UUID id) {
        return EmbeddingJob.builder().id(id).build();
    }

    @Test
    void aFailureWhileEnqueuingNeverPropagates() {
        when(transactionTemplate.execute(any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> service.enqueueAndDispatch(UUID.randomUUID())).doesNotThrowAnyException();

        verify(worker, never()).dispatch(any());
    }

    @Test
    void aFailureWhileDispatchingNeverPropagates() {
        transactionsRunInline();
        UUID jobId = UUID.randomUUID();
        when(jobRepository.findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
                any(), anyString(), anyString(), anyString())).thenReturn(Optional.of(job(jobId)));
        org.mockito.Mockito.doThrow(new IllegalStateException("pool down")).when(worker).dispatch(jobId);

        assertThatCode(() -> service.enqueueAndDispatch(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void theJobIsCreatedForTheActivePairThenDispatched() {
        transactionsRunInline();
        UUID profileId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        when(jobRepository.findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
                profileId, "model", "1", ProfileTextRenderer.STRATEGY_VERSION)).thenReturn(Optional.of(job(jobId)));

        service.enqueueAndDispatch(profileId);

        verify(jobRepository).insertPendingIfAbsent(any(), org.mockito.ArgumentMatchers.eq(profileId),
                org.mockito.ArgumentMatchers.eq("model"), org.mockito.ArgumentMatchers.eq("1"),
                org.mockito.ArgumentMatchers.eq(ProfileTextRenderer.STRATEGY_VERSION), any());
        verify(worker).dispatch(jobId);
    }

    @Test
    void backfillWalksTheBatchesUntilNothingIsMissing() {
        transactionsRunInline();
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of(a, b)).thenReturn(List.of(c)).thenReturn(List.of());
        when(jobRepository.findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
                any(), anyString(), anyString(), anyString()))
                .thenAnswer(inv -> Optional.of(job(UUID.randomUUID())));

        assertThat(service.backfillMissingJobs()).isEqualTo(3);

        verify(worker, org.mockito.Mockito.times(3)).dispatch(any());
    }

    @Test
    void backfillWithNothingMissingDoesNothing() {
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of());

        assertThat(service.backfillMissingJobs()).isZero();

        verify(worker, never()).dispatch(any());
    }

    @Test
    void backfillStopsWhenNoJobCanBeCreated() {
        transactionsRunInline();
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of(UUID.randomUUID()));
        when(jobRepository.findByNormalizedProfileIdAndModelNameAndModelVersionAndStrategyVersion(
                any(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());

        // Le même lot reviendrait indéfiniment : la boucle doit s'arrêter, pas tourner à vide.
        assertThat(service.backfillMissingJobs()).isZero();
    }

    // --- démarrage -----------------------------------------------------------

    @Test
    void bootRecoversOrphanJobsButNeverBackfillsByDefault() {
        service.onStartup();

        verify(worker).recoverOrphanJobs();
        verify(jobRepository, never()).findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(),
                anyInt());
    }

    @Test
    void bootBackfillsOnlyWhenTheFlagIsOnAndAfterTheRecovery() {
        EmbeddingService withBackfill =
                new EmbeddingService(jobRepository, settings, worker, transactionTemplate, 2, true);
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of());

        withBackfill.onStartup();

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(worker, jobRepository);
        order.verify(worker).recoverOrphanJobs();
        order.verify(jobRepository).findCurrentProfileIdsWithoutJob("model", "1",
                ProfileTextRenderer.STRATEGY_VERSION, 2);
    }

    @Test
    void aFailingBootRecoveryNeverStopsTheApplicationStartup() {
        EmbeddingService withBackfill =
                new EmbeddingService(jobRepository, settings, worker, transactionTemplate, 2, true);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down")).when(worker).recoverOrphanJobs();

        assertThatCode(withBackfill::onStartup).doesNotThrowAnyException();
    }

    @Test
    void aFailingBackfillAtBootNeverStopsTheApplicationStartup() {
        EmbeddingService withBackfill =
                new EmbeddingService(jobRepository, settings, worker, transactionTemplate, 2, true);
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenThrow(new IllegalStateException("db down"));

        assertThatCode(withBackfill::onStartup).doesNotThrowAnyException();
    }

    @Test
    void theBackfillAsksForTheActivePairAndTheConfiguredBatchSize() {
        when(jobRepository.findCurrentProfileIdsWithoutJob(anyString(), anyString(), anyString(), anyInt()))
                .thenReturn(List.of());

        service.backfillMissingJobs();

        verify(jobRepository).findCurrentProfileIdsWithoutJob("model", "1", ProfileTextRenderer.STRATEGY_VERSION, 2);
    }
}
