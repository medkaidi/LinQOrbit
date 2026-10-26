package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.dto.EmbedResponse;

/**
 * Résilience du worker d'embedding sur PostgreSQL réel : soumission au pool
 * qui échoue, reprise au démarrage dans ses cas limites, erreurs longues,
 * quota répété, précision des vecteurs écrits, courses d'enqueue. Complète
 * {@link EmbeddingIntegrationTest} (cas nominaux et échecs simples).
 */
class EmbeddingResilienceIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CONTENT = """
            {"schemaVersion":"3","title":"Backend Engineer",
             "skills":[{"name":"Java","category":"Programming Languages"}]}""";
    private static final int PENDING = 1;
    private static final int RUNNING = 2;
    private static final int DONE = 3;
    private static final int FAILED = 4;

    @Autowired
    private EmbeddingService embeddingService;
    @Autowired
    private EmbeddingWorker embeddingWorker;
    @Value("${app.embedding.retry-delay-seconds}")
    private int retryDelaySeconds;

    private EmbeddingTestData data;

    /** Reprise bornée au couple de test : la base de dev est partagée, jamais une ligne réelle touchée. */
    private void recoverTestPair() {
        embeddingWorker.recoverOrphanJobs(EmbeddingTestData.TEST_MODEL, "1", ProfileTextRenderer.STRATEGY_VERSION);
    }

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        when(embedClient.embed(anyList())).thenAnswer(inv -> answer(EmbeddingTestData.vector(1f, 2f)));
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
        MDC.clear();
    }

    private static EmbedResponse answer(float[] vector) {
        return new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(vector));
    }

    private UUID candidateFiche() {
        return data.candidateFiche(data.candidate(null), 1, CONTENT);
    }

    private UUID jobId(UUID profileId) {
        return jdbc.queryForObject("SELECT job_id FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", UUID.class, profileId, EmbeddingTestData.TEST_MODEL);
    }

    private Map<String, Object> job(UUID profileId) {
        return jdbc.queryForMap("SELECT status, attempts, next_attempt_at, error FROM embedding_job"
                + " WHERE normalized_profile_id = ? AND model_name = ?", profileId, EmbeddingTestData.TEST_MODEL);
    }

    private int status(UUID profileId) {
        return ((Number) job(profileId).get("status")).intValue();
    }

    private int attempts(UUID profileId) {
        return ((Number) job(profileId).get("attempts")).intValue();
    }

    private int embeddingCount(UUID profileId) {
        return jdbc.queryForObject("SELECT count(*) FROM profile_embedding WHERE normalized_profile_id = ?",
                Integer.class, profileId);
    }

    private int jobCount(UUID profileId) {
        return jdbc.queryForObject("SELECT count(*) FROM embedding_job WHERE normalized_profile_id = ?",
                Integer.class, profileId);
    }

    private void insertJob(UUID profileId, int status, int attempts, String nextAttemptAt, String startedAt) {
        jdbc.update("INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,"
                + " strategy_version, status, attempts, next_attempt_at, created_at, started_at)"
                + " VALUES (?, ?, ?, '1', 'text-1', ?, ?, " + nextAttemptAt + ", now(), "
                + (startedAt == null ? "NULL" : startedAt) + ")",
                UUID.randomUUID(), profileId, EmbeddingTestData.TEST_MODEL, status, attempts);
    }

    // --- soumission au pool ---------------------------------------------------

    @Test
    void aRejectedSubmissionSchedulesAResubmissionAndTheJobStaysPending() {
        UUID profileId = candidateFiche();
        doThrow(new RejectedExecutionException("queue full")).when(embeddingExecutor).execute(any(Runnable.class));
        Instant before = Instant.now();

        embeddingService.enqueueAndDispatch(profileId);

        assertThat(status(profileId)).isEqualTo(PENDING);
        ArgumentCaptor<Instant> at = ArgumentCaptor.forClass(Instant.class);
        verify(embeddingTaskScheduler).schedule(any(Runnable.class), at.capture());
        assertThat(at.getValue()).isAfterOrEqualTo(before.plusSeconds(retryDelaySeconds - 5))
                .isBeforeOrEqualTo(Instant.now().plusSeconds(retryDelaySeconds + 5));
    }

    @Test
    void theScheduledResubmissionEmbedsTheFicheOnceThePoolAcceptsAgain() {
        UUID profileId = candidateFiche();
        doThrow(new RejectedExecutionException("queue full")).when(embeddingExecutor).execute(any(Runnable.class));
        embeddingService.enqueueAndDispatch(profileId);
        ArgumentCaptor<Runnable> scheduled = ArgumentCaptor.forClass(Runnable.class);
        verify(embeddingTaskScheduler).schedule(scheduled.capture(), any(Instant.class));
        org.mockito.Mockito.reset(embeddingExecutor);
        doNothing().when(embeddingExecutor).execute(any(Runnable.class));

        scheduled.getValue().run();

        ArgumentCaptor<Runnable> submitted = ArgumentCaptor.forClass(Runnable.class);
        verify(embeddingExecutor).execute(submitted.capture());
        submitted.getValue().run();
        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
    }

    @Test
    void whenTheSchedulerFailsTooNothingPropagatesAndTheJobStaysPendingForTheBootRecovery() {
        UUID profileId = candidateFiche();
        doThrow(new RejectedExecutionException("queue full")).when(embeddingExecutor).execute(any(Runnable.class));
        doThrow(new IllegalStateException("scheduler down")).when(embeddingTaskScheduler)
                .schedule(any(Runnable.class), any(Instant.class));

        assertThatCode(() -> embeddingService.enqueueAndDispatch(profileId)).doesNotThrowAnyException();

        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(embeddingCount(profileId)).isZero();
    }

    @Test
    void twoEnqueuesRacingOnTheSameFicheCreateOneJobAndEmbedItOnce() throws Exception {
        UUID profileId = candidateFiche();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = threads.submit(() -> {
                start.await();
                embeddingService.enqueueAndDispatch(profileId);
                return null;
            });
            Future<?> second = threads.submit(() -> {
                start.await();
                embeddingService.enqueueAndDispatch(profileId);
                return null;
            });
            start.countDown();
            first.get(15, TimeUnit.SECONDS);
            second.get(15, TimeUnit.SECONDS);
        } finally {
            threads.shutdownNow();
        }

        assertThat(jobCount(profileId)).isEqualTo(1);
        UUID jobId = jobId(profileId);
        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);
        verify(embedClient, times(1)).embed(anyList());
        assertThat(embeddingCount(profileId)).isEqualTo(1);
    }

    // --- exécution ------------------------------------------------------------

    @Test
    void anUnknownJobIsIgnoredWithoutAnyCall() {
        assertThatCode(() -> embeddingWorker.executeJob(UUID.randomUUID())).doesNotThrowAnyException();

        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aRunningFailedOrDoneJobIsNeverClaimedAgain() {
        UUID running = candidateFiche();
        UUID failed = candidateFiche();
        UUID done = candidateFiche();
        insertJob(running, RUNNING, 1, "now()", "now()");
        insertJob(failed, FAILED, 3, "now()", null);
        insertJob(done, DONE, 1, "now()", null);

        embeddingWorker.executeJob(jobId(running));
        embeddingWorker.executeJob(jobId(failed));
        embeddingWorker.executeJob(jobId(done));

        verify(embedClient, never()).embed(anyList());
        assertThat(status(running)).isEqualTo(RUNNING);
        assertThat(status(failed)).isEqualTo(FAILED);
        assertThat(status(done)).isEqualTo(DONE);
    }

    @Test
    void theCorrelationIdIsNeverLeftOnTheThreadAfterAnExecution() {
        UUID profileId = candidateFiche();
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(MDC.get("correlationId")).isNull();
    }

    @Test
    void theCorrelationIdIsAlsoClearedWhenTheExecutionFails() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("boom"));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(MDC.get("correlationId")).isNull();
        assertThat((String) job(profileId).get("error")).isEqualTo("Unexpected error during embedding");
    }

    // --- erreurs --------------------------------------------------------------

    @Test
    void aVeryLongErrorIsTruncatedSoTheJobStateIsStillWritten() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "x".repeat(900)));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        // Sans troncature, l'UPDATE violerait VARCHAR(500) et le job resterait RUNNING pour toujours.
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(((String) job(profileId).get("error"))).hasSize(500);
    }

    @Test
    void aVeryLongErrorOnTheLastAttemptStillEndsInFailed() {
        UUID profileId = candidateFiche();
        insertJob(profileId, PENDING, 2, "now()", null);
        when(embedClient.embed(anyList())).thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "y".repeat(900)));

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(3);
        assertThat(((String) job(profileId).get("error"))).hasSize(500);
    }

    @Test
    void repeatedQuotaAnswersDeferTwiceThenEndInFailed() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenThrow(new AiServiceException(HttpStatus.TOO_MANY_REQUESTS,
                "The embedding service is rate limited, retry later."));
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);

        embeddingWorker.executeJob(jobId);
        LocalDateTime firstNext = nextAttempt(profileId);
        embeddingWorker.executeJob(jobId);
        LocalDateTime secondNext = nextAttempt(profileId);
        embeddingWorker.executeJob(jobId);

        assertThat(firstNext).isAfter(LocalDateTime.now().plusSeconds(240));
        assertThat(secondNext).isAfter(LocalDateTime.now().plusSeconds(240));
        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(3);
        verify(embeddingTaskScheduler, times(2)).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void aFailureThenASuccessEndsDoneAfterOneCountedAttempt() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."))
                .thenAnswer(inv -> answer(EmbeddingTestData.vector(1f)));
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);

        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(attempts(profileId)).isEqualTo(1);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
    }

    // --- reprise au démarrage ---------------------------------------------------

    @Test
    void aPendingJobNotYetDueIsScheduledAtItsDueTimeAndNeverRunEarly() {
        UUID profileId = candidateFiche();
        insertJob(profileId, PENDING, 1, "now() + interval '30 minutes'", null);
        Instant before = Instant.now();

        recoverTestPair();

        ArgumentCaptor<Instant> at = ArgumentCaptor.forClass(Instant.class);
        verify(embeddingTaskScheduler, atLeastOnce()).schedule(any(Runnable.class), at.capture());
        assertThat(at.getAllValues()).anySatisfy(instant -> assertThat(instant)
                .isAfter(before.plusSeconds(29 * 60)).isBefore(before.plusSeconds(31 * 60)));
        assertThat(status(profileId)).isEqualTo(PENDING);
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aStaleRunningJobOnItsLastAttemptIsFailedThenRequeuedByTheSameBootPass() {
        UUID profileId = candidateFiche();
        insertJob(profileId, RUNNING, 2, "now() - interval '1 hour'", "now() - interval '30 minutes'");

        recoverTestPair();

        // 3ᵉ échec cumulé → FAILED, qui relève de la politique du démarrage (FAILED à 3 tentatives
        // relancé, tentatives remises à zéro) : une seule fois par démarrage, jamais en boucle.
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isZero();
        assertThat(job(profileId).get("error")).isNull();
        verify(embeddingExecutor, atLeastOnce()).execute(any(Runnable.class));
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aRecentRunningJobIsLeftAloneBecauseItsWorkerIsStillAlive() {
        UUID profileId = candidateFiche();
        insertJob(profileId, RUNNING, 0, "now()", "now() - interval '2 minutes'");

        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(RUNNING);
        assertThat(attempts(profileId)).isZero();
    }

    @Test
    void aFailedJobBelowTheThreeAttemptsIsNotRequeuedByTheBootRecovery() {
        UUID profileId = candidateFiche();
        insertJob(profileId, FAILED, 1, "now()", null);

        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(1);
    }

    @Test
    void aRequeuedFailedJobIsEmbeddedAndEndsDoneWithoutASecondLine() {
        UUID profileId = candidateFiche();
        insertJob(profileId, FAILED, 3, "now() - interval '1 day'", null);
        UUID jobId = jobId(profileId);

        recoverTestPair();
        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(jobCount(profileId)).isEqualTo(1);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
        assertThat(job(profileId).get("error")).isNull();
    }

    // --- précision des vecteurs ---------------------------------------------------

    @Test
    void smallNegativeAndExponentValuesAreStoredWithoutLoss() {
        UUID profileId = candidateFiche();
        float[] vector = EmbeddingTestData.vector(1.0E-5f, -2.5E-8f, 3.0E-30f, -0.5f, 0.123456789f, 1.17549435E-38f);
        vector[1535] = -1.0f;
        when(embedClient.embed(anyList())).thenReturn(answer(vector));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(status(profileId)).isEqualTo(DONE);
        List<Float> stored = jdbc.query("SELECT unnest(embedding::real[]) FROM profile_embedding"
                + " WHERE normalized_profile_id = ?", (rs, i) -> rs.getFloat(1), profileId);
        assertThat(stored).hasSize(1536);
        for (int i : new int[] {0, 1, 2, 3, 4, 5, 6, 1535}) {
            assertThat(stored.get(i)).as("component %d", i).isEqualTo(vector[i]);
        }
    }

    @Test
    void theStoredVectorIsExactlyTheOneTheProviderReturnedInOrder() {
        UUID profileId = candidateFiche();
        float[] vector = new float[1536];
        for (int i = 0; i < vector.length; i++) {
            vector[i] = (i % 2 == 0 ? 1 : -1) * (i + 1) / 4096f;
        }
        when(embedClient.embed(anyList())).thenReturn(answer(vector));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        List<Float> stored = jdbc.query("SELECT unnest(embedding::real[]) FROM profile_embedding"
                + " WHERE normalized_profile_id = ?", (rs, i) -> rs.getFloat(1), profileId);
        for (int i = 0; i < vector.length; i++) {
            assertThat(stored.get(i)).as("component %d", i).isEqualTo(vector[i]);
        }
    }

    private LocalDateTime nextAttempt(UUID profileId) {
        return ((java.sql.Timestamp) job(profileId).get("next_attempt_at")).toLocalDateTime();
    }
}
