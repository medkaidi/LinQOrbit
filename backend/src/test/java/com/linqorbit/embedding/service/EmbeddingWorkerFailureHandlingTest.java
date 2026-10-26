package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.linqorbit.candidate.entity.NormalizedProfile;
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
 * Audit T-64 (A2, A4, A5, A6) : le worker réel, collaborateurs simulés. Ce que seul un faux repository
 * sait provoquer — une panne d'écriture après la réponse IA, un claim qui lève, une métadonnée de
 * dimension mensongère — et la discrimination des {@code FAILED} au démarrage. Le SQL et la base
 * réelle sont couverts par {@code EmbeddingResilienceIntegrationTest}.
 */
class EmbeddingWorkerFailureHandlingTest {

    private static final long INTERVAL_MS = 300;
    private static final String MODEL = "model";
    private static final String RENDERABLE = "{\"schemaVersion\":\"3\",\"title\":\"Backend Engineer\"}";
    private static final String NOT_RENDERABLE = "{}";

    private final EmbeddingJobRepository jobs = mock(EmbeddingJobRepository.class);
    private final ProfileEmbeddingRepository embeddings = mock(ProfileEmbeddingRepository.class);
    private final NormalizedProfileRepository profiles = mock(NormalizedProfileRepository.class);
    private final NormalizedProfileCandidateRepository candidateLinks =
            mock(NormalizedProfileCandidateRepository.class);
    private final EmbedClient embedClient = mock(EmbedClient.class);
    private final TaskScheduler scheduler = mock(TaskScheduler.class);
    private final ThreadPoolTaskExecutor executor = mock(ThreadPoolTaskExecutor.class);

    private final UUID jobId = UUID.randomUUID();
    private final UUID profileId = UUID.randomUUID();

    private EmbeddingWorker worker(long minIntervalMs) {
        return new EmbeddingWorker(executor, scheduler,
                new TransactionTemplate(mock(PlatformTransactionManager.class)), jobs, embeddings, profiles,
                candidateLinks, new ProfileTextRenderer(JsonMapper.builder().build()), embedClient,
                new EmbeddingSettings(MODEL, "1"), mock(ScreeningJobService.class), 60, 300, minIntervalMs);
    }

    private EmbeddingJob job(EmbeddingJobStatus status, int attempts) {
        return EmbeddingJob.builder().id(jobId).normalizedProfileId(profileId).modelName(MODEL).modelVersion("1")
                .strategyVersion(ProfileTextRenderer.STRATEGY_VERSION).status(status).attempts(attempts).build();
    }

    private void aClaimableJob(String content, int attempts) {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenReturn(1);
        when(jobs.findById(jobId)).thenReturn(Optional.of(job(EmbeddingJobStatus.RUNNING, attempts)));
        when(jobs.isCurrentProfile(profileId)).thenReturn(true);
        aFiche(content);
        when(jobs.casDone(eq(jobId), any(), any(), any())).thenReturn(1);
    }

    private void aFiche(String content) {
        when(profiles.findById(profileId)).thenReturn(Optional.of(
                NormalizedProfile.builder().id(profileId).content(content).build()));
        when(candidateLinks.findCandidateIdByNormalizedProfileId(profileId))
                .thenReturn(Optional.of(UUID.randomUUID()));
    }

    private void theProviderAnswers(int declaredDimensions, int vectorLength) {
        float[] vector = new float[vectorLength];
        if (vectorLength > 0) {
            vector[0] = 1f;
        }
        theProviderAnswers(declaredDimensions, vector);
    }

    private void theProviderAnswers(int declaredDimensions, float[] vector) {
        when(embedClient.embed(anyList())).thenReturn(new EmbedResponse(MODEL, declaredDimensions, List.of(vector)));
    }

    private long elapsedMsOf(Runnable action) {
        long start = System.nanoTime();
        action.run();
        return (System.nanoTime() - start) / 1_000_000;
    }

    // --- A2 : débit après un appel fournisseur, même si la suite échoue ---------------------------

    @Test
    void theWorkerWaitsAfterAProviderCallWhoseResultCannotBeWritten() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, 1536);
        when(embeddings.insertIfAbsent(any(), any(), anyString(), anyString(), anyString(), anyString(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        // La réponse IA a été consommée : l'écriture ratée ne dispense pas de respirer avant le job suivant.
        verify(embedClient).embed(anyList());
        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
        verify(jobs, never()).casDone(any(), any(), any(), any());
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void theWorkerWaitsAfterAResponseItRefuses() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, 12);
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void noWaitWhenTheFicheIsNotRenderableOrTheJobIsSuperseded() {
        aClaimableJob(NOT_RENDERABLE, 0);
        EmbeddingWorker worker = worker(5_000);

        long notRenderable = elapsedMsOf(() -> worker.executeJob(jobId));
        when(jobs.isCurrentProfile(profileId)).thenReturn(false);
        long superseded = elapsedMsOf(() -> worker.executeJob(jobId));

        verify(embedClient, never()).embed(anyList());
        assertThat(notRenderable).isLessThan(2_000);
        assertThat(superseded).isLessThan(2_000);
    }

    // --- A4 : la dimension annoncée est vérifiée comme la longueur réelle ------------------------

    @Test
    void aDeclaredDimensionOtherThanTheColumnIsRefusedEvenWithAFullLengthVector() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1535, 1536);
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        verify(embeddings, never()).insertIfAbsent(any(), any(), anyString(), anyString(), anyString(),
                anyString(), any());
        verify(jobs, never()).casDone(any(), any(), any(), any());
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void aMatchingDeclarationWithAShortVectorIsStillRefused() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, 1535);
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        verify(embeddings, never()).insertIfAbsent(any(), any(), anyString(), anyString(), anyString(),
                anyString(), any());
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void aConsistentDeclarationAndVectorIsWritten() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, 1536);
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        verify(embeddings).insertIfAbsent(any(), eq(profileId), anyString(), eq(MODEL), eq("1"),
                eq(ProfileTextRenderer.STRATEGY_VERSION), any());
        verify(jobs).casDone(eq(jobId), any(), any(), any());
    }

    // --- A6 : un claim qui lève ne laisse jamais le job sans suite -----------------------------

    @Test
    void aClaimThatThrowsSchedulesAResubmissionAndNeverPropagates() {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenThrow(new IllegalStateException("db down"));
        EmbeddingWorker worker = worker(0);

        assertThatCode(() -> worker.executeJob(jobId)).doesNotThrowAnyException();

        ArgumentCaptor<Instant> at = ArgumentCaptor.forClass(Instant.class);
        verify(scheduler).schedule(any(Runnable.class), at.capture());
        assertThat(at.getValue()).isAfter(Instant.now().plusSeconds(30));
        // Statut inchangé : aucune transition n'a eu lieu, l'exclusivité reste au CAS de la re-soumission.
        verify(jobs, never()).casRetry(any(), any(), any(), anyInt(), any(), any());
        verify(jobs, never()).casFail(any(), any(), any(), anyInt(), any(), any());
        verify(jobs, never()).casSupersede(any(), any(), any(), any());
        verify(jobs, never()).casDone(any(), any(), any(), any());
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aClaimThatThrowsWhileTheSchedulerIsDownStillNeverPropagates() {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenThrow(new IllegalStateException("db down"));
        when(scheduler.schedule(any(Runnable.class), any(Instant.class)))
                .thenThrow(new IllegalStateException("scheduler down"));
        EmbeddingWorker worker = worker(0);

        // Dernier filet : le job reste PENDING, la reprise au démarrage le reprendra.
        assertThatCode(() -> worker.executeJob(jobId)).doesNotThrowAnyException();
    }

    @Test
    void aJobThatCannotBeClaimedIsLeftAloneWithoutAResubmission() {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenReturn(0);
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        verify(scheduler, never()).schedule(any(Runnable.class), any(Instant.class));
    }

    // --- A5 : au démarrage, seul un fournisseur épuisé est relancé -------------------------------

    private void aFailedJob(int attempts, String content) {
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED))
                .thenReturn(List.of(job(EmbeddingJobStatus.FAILED, attempts)));
        aFiche(content);
        when(jobs.casRequeue(eq(jobId), any(), any(), any())).thenReturn(1);
    }

    @Test
    void aFailedJobBelowTheThreeAttemptsIsNeverRequeuedAtBoot() {
        aFailedJob(1, RENDERABLE);

        worker(0).recoverOrphanJobs();

        verify(jobs, never()).casRequeue(any(), any(), any(), any());
        verify(profiles, never()).findById(any());
    }

    @Test
    void anExhaustedProviderIsRequeuedAtBootWithoutCallingIt() {
        aFailedJob(3, RENDERABLE);

        worker(0).recoverOrphanJobs();

        verify(jobs).casRequeue(eq(jobId), eq(EmbeddingJobStatus.FAILED), eq(EmbeddingJobStatus.PENDING), any());
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aNotRenderableFicheStaysFailedAtBootEvenAfterTechnicalFailures() {
        // Deux échecs techniques puis un rendu impossible : le compteur atteint 3 comme un fournisseur épuisé.
        aClaimableJob(NOT_RENDERABLE, 2);
        EmbeddingWorker worker = worker(0);

        worker.executeJob(jobId);

        ArgumentCaptor<Integer> attempts = ArgumentCaptor.forClass(Integer.class);
        verify(jobs).casFail(eq(jobId), any(), eq(EmbeddingJobStatus.FAILED), attempts.capture(), any(), anyString());
        assertThat(attempts.getValue()).isEqualTo(EmbeddingWorker.MAX_ATTEMPTS);

        aFailedJob(attempts.getValue(), NOT_RENDERABLE);
        worker.recoverOrphanJobs();

        verify(jobs, never()).casRequeue(any(), any(), any(), any());
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aFailedJobWhoseFicheCannotBeCheckedIsNotRequeuedAtBoot() {
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED))
                .thenReturn(List.of(job(EmbeddingJobStatus.FAILED, 3)));
        when(profiles.findById(profileId)).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> worker(0).recoverOrphanJobs()).doesNotThrowAnyException();

        verify(jobs, never()).casRequeue(any(), any(), any(), any());
    }

    @Test
    void aFailedJobWithoutFicheIsNotRequeuedAtBoot() {
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED))
                .thenReturn(List.of(job(EmbeddingJobStatus.FAILED, 3)));
        when(profiles.findById(profileId)).thenReturn(Optional.empty());

        worker(0).recoverOrphanJobs();

        verify(jobs, never()).casRequeue(any(), any(), any(), any());
    }

    // --- C1 : un vecteur de norme nulle n'est jamais écrit ---------------------------------------

    @Test
    void aZeroVectorIsRefusedAndNothingIsWritten() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, new float[1536]);

        worker(0).executeJob(jobId);

        verify(embeddings, never()).insertIfAbsent(any(), any(), anyString(), anyString(), anyString(),
                anyString(), any());
        verify(jobs, never()).casDone(any(), any(), any(), any());
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void aVectorOfNegativeZerosIsRefusedLikeAZeroVector() {
        aClaimableJob(RENDERABLE, 0);
        float[] negativeZeros = new float[1536];
        java.util.Arrays.fill(negativeZeros, -0f);
        theProviderAnswers(1536, negativeZeros);

        worker(0).executeJob(jobId);

        verify(embeddings, never()).insertIfAbsent(any(), any(), anyString(), anyString(), anyString(),
                anyString(), any());
        verify(jobs).casRetry(eq(jobId), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void aZeroVectorOnTheThirdExecutionEndsFailed() {
        aClaimableJob(RENDERABLE, 2);
        theProviderAnswers(1536, new float[1536]);

        worker(0).executeJob(jobId);

        verify(jobs).casFail(eq(jobId), any(), eq(EmbeddingJobStatus.FAILED), eq(EmbeddingWorker.MAX_ATTEMPTS),
                any(LocalDateTime.class), anyString());
        verify(embeddings, never()).insertIfAbsent(any(), any(), anyString(), anyString(), anyString(),
                anyString(), any());
    }

    @Test
    void aSingleNonZeroComponentIsEnoughToBeWritten() {
        aClaimableJob(RENDERABLE, 0);
        float[] tiny = new float[1536];
        tiny[1535] = Float.MIN_VALUE;
        theProviderAnswers(1536, tiny);

        worker(0).executeJob(jobId);

        // Même la plus petite valeur positive : le vecteur n'est pas nul (la norme est calculée en double).
        verify(embeddings).insertIfAbsent(any(), eq(profileId), anyString(), eq(MODEL), eq("1"),
                eq(ProfileTextRenderer.STRATEGY_VERSION), any());
    }

    // --- C2 : la temporisation survit à l'échec de la transition post-appel ----------------------

    @Test
    void theWorkerStillWaitsWhenTheRetryTransitionItselfFails() {
        aClaimableJob(RENDERABLE, 0);
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("provider down"));
        when(jobs.casRetry(any(), any(), any(), anyInt(), any(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long[] elapsed = new long[1];
        assertThatCode(() -> elapsed[0] = elapsedMsOf(() -> worker.executeJob(jobId))).doesNotThrowAnyException();

        verify(embedClient).embed(anyList());
        assertThat(elapsed[0]).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
        // Aucune autre transition n'a eu lieu : le job reste RUNNING pour le recovery des RUNNING périmés.
        verify(jobs, never()).casDone(any(), any(), any(), any());
        verify(jobs, never()).casFail(any(), any(), any(), anyInt(), any(), any());
        verify(jobs, never()).casSupersede(any(), any(), any(), any());
    }

    @Test
    void theWorkerStillWaitsWhenTheFailTransitionItselfFails() {
        aClaimableJob(RENDERABLE, 2);
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("provider down"));
        when(jobs.casFail(any(), any(), any(), anyInt(), any(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
    }

    @Test
    void theWorkerStillWaitsWhenAProviderErrorAndItsRetryTransitionBothFail() {
        aClaimableJob(RENDERABLE, 0);
        when(embedClient.embed(anyList()))
                .thenThrow(new com.linqorbit.candidate.exception.AiServiceException(
                        org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "rate limited"));
        when(jobs.casRetry(any(), any(), any(), anyInt(), any(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
    }

    @Test
    void theWorkerStillWaitsWhenTheDoneTransitionFailsAfterAValidResponse() {
        aClaimableJob(RENDERABLE, 0);
        theProviderAnswers(1536, 1536);
        when(jobs.casDone(any(), any(), any(), any())).thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(INTERVAL_MS);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isGreaterThanOrEqualTo(INTERVAL_MS - 20);
    }

    @Test
    void noWaitWhenTheProviderIsNeverCalledEvenIfTheFailTransitionFails() {
        aClaimableJob(NOT_RENDERABLE, 0);
        when(jobs.casFail(any(), any(), any(), anyInt(), any(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        EmbeddingWorker worker = worker(5_000);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        verify(embedClient, never()).embed(anyList());
        assertThat(elapsed).isLessThan(2_000);
    }

    @Test
    void noWaitWhenTheSupersedeTransitionFailsWithoutAProviderCall() {
        aClaimableJob(RENDERABLE, 0);
        when(jobs.isCurrentProfile(profileId)).thenReturn(false);
        when(jobs.casSupersede(any(), any(), any(), any())).thenThrow(new IllegalStateException("db down"));
        EmbeddingWorker worker = worker(5_000);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        verify(embedClient, never()).embed(anyList());
        assertThat(elapsed).isLessThan(2_000);
    }

    @Test
    void noWaitWhenTheClaimIsLost() {
        when(jobs.casStatus(eq(jobId), any(), any(), any())).thenReturn(0);
        EmbeddingWorker worker = worker(5_000);

        long elapsed = elapsedMsOf(() -> worker.executeJob(jobId));

        assertThat(elapsed).isLessThan(2_000);
    }

    // --- C3 : la reprise au démarrage ne touche que le couple visé --------------------------------

    private EmbeddingJob jobOf(String model, EmbeddingJobStatus status, int attempts) {
        return EmbeddingJob.builder().id(UUID.randomUUID()).normalizedProfileId(profileId).modelName(model)
                .modelVersion("1").strategyVersion(ProfileTextRenderer.STRATEGY_VERSION).status(status)
                .attempts(attempts).nextAttemptAt(LocalDateTime.now().minusMinutes(1))
                .startedAt(LocalDateTime.now().minusHours(1)).build();
    }

    @Test
    void aFailedJobOfAnInactivePairIsNeverRequeuedAtBoot() {
        EmbeddingJob old = jobOf("old-model", EmbeddingJobStatus.FAILED, 3);
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED)).thenReturn(List.of(old));
        aFiche(RENDERABLE);

        worker(0).recoverOrphanJobs();

        verify(jobs, never()).casRequeue(any(), any(), any(), any());
    }

    @Test
    void onlyTheFailedJobsOfTheActivePairAreRequeuedAtBoot() {
        EmbeddingJob old = jobOf("old-model", EmbeddingJobStatus.FAILED, 3);
        EmbeddingJob active = jobOf(MODEL, EmbeddingJobStatus.FAILED, 3);
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED)).thenReturn(List.of(old, active));
        aFiche(RENDERABLE);
        when(jobs.casRequeue(eq(active.getId()), any(), any(), any())).thenReturn(1);

        worker(0).recoverOrphanJobs();

        verify(jobs).casRequeue(eq(active.getId()), eq(EmbeddingJobStatus.FAILED), eq(EmbeddingJobStatus.PENDING),
                any());
        verify(jobs, never()).casRequeue(eq(old.getId()), any(), any(), any());
        verify(executor).execute(any(Runnable.class));
    }

    @Test
    void theScopedRecoveryRequeuesOnlyTheFailedJobsOfItsPair() {
        EmbeddingJob scoped = jobOf("scoped-model", EmbeddingJobStatus.FAILED, 3);
        EmbeddingJob active = jobOf(MODEL, EmbeddingJobStatus.FAILED, 3);
        EmbeddingJob otherVersion = EmbeddingJob.builder().id(UUID.randomUUID()).normalizedProfileId(profileId)
                .modelName("scoped-model").modelVersion("2").strategyVersion(ProfileTextRenderer.STRATEGY_VERSION)
                .status(EmbeddingJobStatus.FAILED).attempts(3).build();
        EmbeddingJob otherStrategy = EmbeddingJob.builder().id(UUID.randomUUID()).normalizedProfileId(profileId)
                .modelName("scoped-model").modelVersion("1").strategyVersion("text-0")
                .status(EmbeddingJobStatus.FAILED).attempts(3).build();
        when(jobs.findByStatus(EmbeddingJobStatus.FAILED))
                .thenReturn(List.of(scoped, active, otherVersion, otherStrategy));
        aFiche(RENDERABLE);
        when(jobs.casRequeue(eq(scoped.getId()), any(), any(), any())).thenReturn(1);

        worker(0).recoverOrphanJobs("scoped-model", "1", ProfileTextRenderer.STRATEGY_VERSION);

        verify(jobs).casRequeue(eq(scoped.getId()), any(), any(), any());
        verify(jobs, never()).casRequeue(eq(active.getId()), any(), any(), any());
        verify(jobs, never()).casRequeue(eq(otherVersion.getId()), any(), any(), any());
        verify(jobs, never()).casRequeue(eq(otherStrategy.getId()), any(), any(), any());
    }

    @Test
    void theScopedRecoveryNeverTouchesThePendingOrStaleRunningJobsOfAnotherPair() {
        EmbeddingJob pending = jobOf("other-model", EmbeddingJobStatus.PENDING, 0);
        EmbeddingJob stale = jobOf("other-model", EmbeddingJobStatus.RUNNING, 0);
        when(jobs.findByStatus(EmbeddingJobStatus.PENDING)).thenReturn(List.of(pending));
        when(jobs.findByStatusAndStartedAtLessThanEqual(eq(EmbeddingJobStatus.RUNNING), any()))
                .thenReturn(List.of(stale));

        worker(0).recoverOrphanJobs("scoped-model", "1", ProfileTextRenderer.STRATEGY_VERSION);

        verify(executor, never()).execute(any(Runnable.class));
        verify(scheduler, never()).schedule(any(Runnable.class), any(Instant.class));
        verify(jobs, never()).casRetry(any(), any(), any(), anyInt(), any(), any());
        verify(jobs, never()).casFail(any(), any(), any(), anyInt(), any(), any());
    }

    @Test
    void theScopedRecoveryStillHandlesThePendingAndStaleRunningJobsOfItsPair() {
        EmbeddingJob pending = jobOf("scoped-model", EmbeddingJobStatus.PENDING, 0);
        EmbeddingJob stale = jobOf("scoped-model", EmbeddingJobStatus.RUNNING, 0);
        when(jobs.findByStatus(EmbeddingJobStatus.PENDING)).thenReturn(List.of(pending));
        when(jobs.findByStatusAndStartedAtLessThanEqual(eq(EmbeddingJobStatus.RUNNING), any()))
                .thenReturn(List.of(stale));

        worker(0).recoverOrphanJobs("scoped-model", "1", ProfileTextRenderer.STRATEGY_VERSION);

        verify(executor).execute(any(Runnable.class));
        verify(jobs).casRetry(eq(stale.getId()), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void theProductionRecoveryKeepsHandlingThePendingAndStaleJobsOfAnyPair() {
        // Comportement produit inchangé : un PENDING d'un ancien couple est exécuté (donc écarté SUPERSEDED).
        EmbeddingJob pending = jobOf("old-model", EmbeddingJobStatus.PENDING, 0);
        EmbeddingJob stale = jobOf("old-model", EmbeddingJobStatus.RUNNING, 0);
        when(jobs.findByStatus(EmbeddingJobStatus.PENDING)).thenReturn(List.of(pending));
        when(jobs.findByStatusAndStartedAtLessThanEqual(eq(EmbeddingJobStatus.RUNNING), any()))
                .thenReturn(List.of(stale));

        worker(0).recoverOrphanJobs();

        verify(executor).execute(any(Runnable.class));
        verify(jobs).casRetry(eq(stale.getId()), any(), any(), eq(1), any(LocalDateTime.class), anyString());
    }

    @Test
    void aNotYetDuePendingJobIsScheduledNotExecuted() {
        EmbeddingJob later = jobOf(MODEL, EmbeddingJobStatus.PENDING, 1);
        later.setNextAttemptAt(LocalDateTime.now().plusMinutes(5));
        when(jobs.findByStatus(EmbeddingJobStatus.PENDING)).thenReturn(List.of(later));

        worker(0).recoverOrphanJobs();

        verify(executor, never()).execute(any(Runnable.class));
        verify(scheduler).schedule(any(Runnable.class), any(Instant.class));
    }
}
