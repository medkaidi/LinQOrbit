package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.embedding.client.EmbedClient;
import com.linqorbit.embedding.dto.EmbedResponse;
import com.linqorbit.embedding.entity.EmbeddingJob;
import com.linqorbit.embedding.entity.EmbeddingJobStatus;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;
import com.linqorbit.embedding.repository.ProfileEmbeddingRepository;
import com.linqorbit.screening.service.ScreeningJobService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Débit borné vers le fournisseur (quota du palier gratuit) : le thread du
 * worker attend {@code min-interval-ms} après chaque appel au fournisseur,
 * jamais quand aucun appel n'a eu lieu. Le temps n'est pas observable depuis
 * les ITs (intervalle à zéro) : worker réel, collaborateurs simulés.
 */
class EmbeddingWorkerThrottleTest {

    private static final long INTERVAL_MS = 300;
    private static final String MODEL = "model";

    private final EmbeddingJobRepository jobs = mock(EmbeddingJobRepository.class);
    private final ProfileEmbeddingRepository embeddings = mock(ProfileEmbeddingRepository.class);
    private final NormalizedProfileRepository profiles = mock(NormalizedProfileRepository.class);
    private final NormalizedProfileCandidateRepository candidateLinks =
            mock(NormalizedProfileCandidateRepository.class);
    private final EmbedClient embedClient = mock(EmbedClient.class);

    private final UUID jobId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();

    private EmbeddingWorker worker(long minIntervalMs) {
        return new EmbeddingWorker(mock(ThreadPoolTaskExecutor.class), mock(TaskScheduler.class),
                new TransactionTemplate(mock(PlatformTransactionManager.class)), jobs, embeddings, profiles,
                candidateLinks, new ProfileTextRenderer(JsonMapper.builder().build()), embedClient,
                new EmbeddingSettings(MODEL, "1"), mock(ScreeningJobService.class), 60, 300, minIntervalMs);
    }

    private void aClaimableJob(String strategy) {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenReturn(1);
        when(jobs.findById(jobId)).thenReturn(Optional.of(EmbeddingJob.builder().id(jobId)
                .normalizedProfileId(profileId).modelName(MODEL).modelVersion("1").strategyVersion(strategy)
                .status(EmbeddingJobStatus.RUNNING).attempts(0).build()));
        when(jobs.isCurrentProfile(profileId)).thenReturn(true);
        when(profiles.findById(profileId)).thenReturn(Optional.of(NormalizedProfile.builder().id(profileId)
                .content("{\"schemaVersion\":\"3\",\"title\":\"Backend Engineer\"}").build()));
        when(candidateLinks.findCandidateIdByNormalizedProfileId(profileId)).thenReturn(Optional.of(UUID.randomUUID()));
        when(jobs.casDone(eq(jobId), any(), any(), any())).thenReturn(1);
    }

    private void theProviderAnswers() {
        when(embedClient.embed(anyList())).thenReturn(new EmbedResponse(MODEL, 1536, List.of(new float[1536])));
    }

    private long elapsedMsOf(Runnable action) {
        long start = System.nanoTime();
        action.run();
        return (System.nanoTime() - start) / 1_000_000;
    }

    @Test
    void theWorkerWaitsTheMinIntervalAfterAProviderCall() {
        aClaimableJob(ProfileTextRenderer.STRATEGY_VERSION);
        theProviderAnswers();
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        verify(embedClient).embed(anyList());
        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
    }

    @Test
    void theWorkerAlsoWaitsAfterAFailedProviderCall() {
        aClaimableJob(ProfileTextRenderer.STRATEGY_VERSION);
        when(embedClient.embed(anyList()))
                .thenThrow(new AiServiceException(HttpStatus.TOO_MANY_REQUESTS, "rate limited"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        // Un quota épuisé ne s'insiste pas : le thread respire avant le job suivant.
        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
        verify(jobs).casRetry(eq(jobId), any(), any(), anyInt(), any(LocalDateTime.class), anyString());
    }

    @Test
    void noWaitHappensWhenTheProviderIsNeverCalled() {
        aClaimableJob("text-0");
        EmbeddingWorker worker = worker(5_000);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        verify(embedClient, never()).embed(anyList());
        assertThat(elapsed).isLessThan(2_000);
    }

    @Test
    void aZeroIntervalNeverWaits() {
        aClaimableJob(ProfileTextRenderer.STRATEGY_VERSION);
        theProviderAnswers();
        EmbeddingWorker worker = worker(0);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isLessThan(250);
    }

    @Test
    void theSourceOfTheRenderingFollowsTheLinkOfTheFiche() {
        aClaimableJob(ProfileTextRenderer.STRATEGY_VERSION);
        theProviderAnswers();
        when(candidateLinks.findCandidateIdByNormalizedProfileId(profileId)).thenReturn(Optional.empty());
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<String>> texts = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(embedClient).embed(texts.capture());
        // Aucun lien candidat : la fiche est une offre, rendue avec le vocabulaire des offres.
        assertThat(texts.getValue().get(0)).startsWith("Job offer\n");
    }
}
