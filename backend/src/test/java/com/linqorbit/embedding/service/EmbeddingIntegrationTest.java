package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
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
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.dto.EmbedResponse;

/**
 * Génération d'embeddings sur PostgreSQL réel (T-64) : fiche normalisée →
 * job → vecteur, conservation multi-modèle, idempotence, fiches périmées
 * jamais embeddées, échecs/retries/quota, reprise au démarrage et backfill.
 * Le service IA et les pools sont simulés ; le worker est piloté à la main.
 * Données tracées et modèle de test dédié : rien d'autre n'est supprimé.
 */
class EmbeddingIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CANDIDATE_CONTENT = """
            {"schemaVersion":"3","title":"Backend Engineer",
             "skills":[{"name":"Java","category":"Programming Languages"}]}""";
    private static final String OFFER_CONTENT = """
            {"schemaVersion":"2","title":"Java Developer",
             "requiredSkills":[{"name":"Java","category":"Programming Languages"}]}""";

    @Autowired
    private EmbeddingService embeddingService;
    @Autowired
    private EmbeddingWorker embeddingWorker;

    private EmbeddingTestData data;

    /** Reprise bornée au couple de test : la base de dev est partagée, jamais une ligne réelle touchée. */
    private void recoverTestPair() {
        embeddingWorker.recoverOrphanJobs(EmbeddingTestData.TEST_MODEL, "1", ProfileTextRenderer.STRATEGY_VERSION);
    }

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        when(embedClient.embed(anyList())).thenAnswer(inv -> embedded());
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private static EmbedResponse embedded() {
        return new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(EmbeddingTestData.vector(1f, 2f)));
    }

    private UUID run(UUID profileId) {
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);
        embeddingWorker.executeJob(jobId);
        return jobId;
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

    private static final int PENDING = 1;
    private static final int RUNNING = 2;
    private static final int DONE = 3;
    private static final int FAILED = 4;
    private static final int SUPERSEDED = 5;

    // --- nominal ---------------------------------------------------------------

    @Test
    void aNormalizedCandidateFicheIsEmbeddedThroughItsJob() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);

        embeddingService.enqueueAndDispatch(profileId);
        assertThat(status(profileId)).isEqualTo(PENDING);
        verify(embeddingExecutor).execute(any(Runnable.class));

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(job(profileId).get("error")).isNull();
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT vector_dims(embedding) AS dims, model_name, model_version, strategy_version
                FROM profile_embedding WHERE normalized_profile_id = ?""", profileId);
        assertThat(row.get("dims")).isEqualTo(1536);
        assertThat(row.get("model_name")).isEqualTo(EmbeddingTestData.TEST_MODEL);
        assertThat(row.get("model_version")).isEqualTo("1");
        assertThat(row.get("strategy_version")).isEqualTo("text-1");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> texts = ArgumentCaptor.forClass(List.class);
        verify(embedClient).embed(texts.capture());
        assertThat(texts.getValue()).hasSize(1);
        assertThat(texts.getValue().get(0)).startsWith("Candidate profile\n").contains("Java");
    }

    @Test
    void aNormalizedOfferFicheIsEmbeddedWithTheOfferRendering() {
        UUID profileId = data.offerFiche(data.offer(), 1, OFFER_CONTENT);

        run(profileId);

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> texts = ArgumentCaptor.forClass(List.class);
        verify(embedClient).embed(texts.capture());
        assertThat(texts.getValue().get(0)).startsWith("Job offer\n").contains("Java Developer");
    }

    // --- idempotence & conservation --------------------------------------------

    @Test
    void enqueuingTwiceCreatesOneJobAndRunningTwiceEmbedsOnce() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);

        UUID jobId = run(profileId);
        embeddingService.enqueueAndDispatch(profileId);
        embeddingWorker.executeJob(jobId);

        assertThat(jobCount(profileId)).isEqualTo(1);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
        assertThat(status(profileId)).isEqualTo(DONE);
        verify(embedClient, times(1)).embed(anyList());
    }

    @Test
    void twoWorkersRacingOnTheSameJobEmbedItOnlyOnce() throws Exception {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);
        CountDownLatch inProvider = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(embedClient.embed(anyList())).thenAnswer(inv -> {
            inProvider.countDown();
            release.await(10, TimeUnit.SECONDS);
            return embedded();
        });
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<?> winner = threads.submit(() -> embeddingWorker.executeJob(jobId));
            assertThat(inProvider.await(10, TimeUnit.SECONDS)).isTrue();
            // Le gagnant est RUNNING dans l'appel IA : le perdant ne réclame rien.
            Future<?> loser = threads.submit(() -> embeddingWorker.executeJob(jobId));
            loser.get(10, TimeUnit.SECONDS);
            release.countDown();
            winner.get(10, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            threads.shutdownNow();
        }

        verify(embedClient, times(1)).embed(anyList());
        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(embeddingCount(profileId)).isEqualTo(1);
    }

    @Test
    void anotherModelOrStrategyAddsALineAndKeepsTheOldVector() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        data.embedding(profileId, "legacy-model", "text-0", 1f);

        run(profileId);

        assertThat(embeddingCount(profileId)).isEqualTo(2);
        assertThat(jdbc.queryForList("SELECT model_name FROM profile_embedding WHERE normalized_profile_id = ?"
                + " ORDER BY model_name", String.class, profileId))
                .containsExactly(EmbeddingTestData.TEST_MODEL, "legacy-model");
    }

    @Test
    void theUniquenessIsPerFicheModelVersionAndStrategy() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        data.embedding(profileId, 1f);

        // Même couple déjà vectorisé : l'écriture idempotente conserve l'existant.
        run(profileId);

        assertThat(embeddingCount(profileId)).isEqualTo(1);
        assertThat(status(profileId)).isEqualTo(DONE);
    }

    // --- fiches périmées / configuration obsolète -------------------------------

    @Test
    void aFicheThatIsNoLongerCurrentIsSupersededWithoutCallingTheProvider() {
        UUID candidateId = data.candidate(null);
        UUID oldFiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.candidateFiche(candidateId, 2, CANDIDATE_CONTENT);

        run(oldFiche);

        assertThat(status(oldFiche)).isEqualTo(SUPERSEDED);
        assertThat(embeddingCount(oldFiche)).isZero();
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aFicheWithoutContentIsNeverEmbedded() {
        UUID candidateId = data.candidate(null);
        data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        UUID pending = data.candidateFiche(candidateId, 2, null);

        run(pending);

        assertThat(status(pending)).isEqualTo(SUPERSEDED);
        assertThat(embeddingCount(pending)).isZero();
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void theCurrentFicheIsTheLatestWithContentEvenWhenANewerOneIsStillAnalysing() {
        UUID candidateId = data.candidate(null);
        UUID current = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.candidateFiche(candidateId, 2, null);

        run(current);

        assertThat(status(current)).isEqualTo(DONE);
        assertThat(embeddingCount(current)).isEqualTo(1);
    }

    @Test
    void aJobOfAnObsoleteConfigurationIsSupersededWithoutCallingTheProvider() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        UUID jobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,
                                           strategy_version, status, attempts, next_attempt_at, created_at)
                VALUES (?, ?, ?, '1', 'text-0', 1, 0, now(), now())""", jobId, profileId,
                EmbeddingTestData.TEST_MODEL);

        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(SUPERSEDED);
        assertThat(embeddingCount(profileId)).isZero();
        verify(embedClient, never()).embed(anyList());
    }

    // --- échecs ---------------------------------------------------------------

    @Test
    void aProviderFailureSchedulesARetryAndWritesNoVector() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."));

        run(profileId);

        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isEqualTo(1);
        assertThat(job(profileId).get("error")).isEqualTo("The AI service call failed.");
        assertThat(embeddingCount(profileId)).isZero();
        verify(embeddingTaskScheduler).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void threeFailuresEndInFailedAndNeverARetryAgain() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList()))
                .thenThrow(new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable."));

        UUID jobId = run(profileId);
        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(3);
        verify(embedClient, times(3)).embed(anyList());
        verify(embeddingTaskScheduler, times(2)).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void aQuotaAnswerDefersTheRetryFarBeyondTheUsualDelay() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList())).thenThrow(new AiServiceException(HttpStatus.TOO_MANY_REQUESTS,
                "The embedding service is rate limited, retry later."));

        run(profileId);

        LocalDateTime next = ((java.sql.Timestamp) job(profileId).get("next_attempt_at")).toLocalDateTime();
        assertThat(next).isAfter(LocalDateTime.now().plusSeconds(240));
        assertThat(status(profileId)).isEqualTo(PENDING);
    }

    @Test
    void aVectorFromAnotherModelThanTheActiveOneIsNeverStored() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList())).thenReturn(
                new EmbedResponse("some-other-model", 1536, List.of(EmbeddingTestData.vector(1f))));

        run(profileId);

        assertThat(embeddingCount(profileId)).isZero();
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat((String) job(profileId).get("error")).contains("some-other-model");
    }

    @Test
    void aWrongShapeOrANonFiniteValueIsNeverStored() {
        UUID shortVector = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList())).thenReturn(
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 3, List.of(new float[] {1f, 2f, 3f})));
        run(shortVector);
        assertThat(embeddingCount(shortVector)).isZero();

        UUID nan = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        float[] withNaN = EmbeddingTestData.vector(1f);
        withNaN[10] = Float.NaN;
        when(embedClient.embed(anyList())).thenReturn(
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(withNaN)));
        run(nan);
        assertThat(embeddingCount(nan)).isZero();

        UUID twoVectors = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList())).thenReturn(new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536,
                List.of(EmbeddingTestData.vector(1f), EmbeddingTestData.vector(2f))));
        run(twoVectors);
        assertThat(embeddingCount(twoVectors)).isZero();
        assertThat(status(twoVectors)).isEqualTo(PENDING);
    }

    @Test
    void aFicheWithNothingToRenderFailsForGoodWithoutCallingTheProvider() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, "{}");

        run(profileId);

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(1);
        assertThat((String) job(profileId).get("error")).contains("nothing to embed");
        verify(embedClient, never()).embed(anyList());
        verify(embeddingTaskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void anEmbeddingFailureNeverTouchesTheNormalizationOfTheFiche() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("boom"));

        run(profileId);

        assertThat(jdbc.queryForObject("SELECT content IS NOT NULL FROM normalized_profile"
                + " WHERE normalized_profile_id = ?", Boolean.class, profileId)).isTrue();
        assertThat(status(profileId)).isEqualTo(PENDING);
    }

    // --- reprise au démarrage ---------------------------------------------------

    @Test
    void bootRecoveryRetriesAStaleRunningJobRequeuesFailedOnesAndDispatchesDueOnes() {
        UUID stale = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        UUID failed = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        UUID due = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        insertJob(stale, RUNNING, 0, "now() - interval '30 minutes'", "now() - interval '30 minutes'");
        insertJob(failed, FAILED, 3, "now() - interval '1 day'", null);
        insertJob(due, PENDING, 0, "now() - interval '1 minute'", null);

        recoverTestPair();

        assertThat(status(stale)).isEqualTo(PENDING);
        assertThat(attempts(stale)).isEqualTo(1);
        assertThat(status(failed)).isEqualTo(PENDING);
        assertThat(attempts(failed)).isZero();
        assertThat(job(failed).get("error")).isNull();
        assertThat(status(due)).isEqualTo(PENDING);
        verify(embeddingExecutor, atLeastOnce()).execute(any(Runnable.class));
        verify(embeddingTaskScheduler, atLeastOnce()).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void bootRecoveryNeverRequeuesAFinalFailure() {
        UUID notRenderable = data.candidateFiche(data.candidate(null), 1, "{}");
        run(notRenderable);
        assertThat(status(notRenderable)).isEqualTo(FAILED);

        recoverTestPair();

        // Rendu déterministe : un échec définitif (1 tentative) ne repart pas à chaque démarrage.
        assertThat(status(notRenderable)).isEqualTo(FAILED);
        assertThat(attempts(notRenderable)).isEqualTo(1);
    }

    @Test
    void bootRecoveryNeverTouchesDoneOrSupersededJobs() {
        UUID done = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        UUID superseded = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        insertJob(done, DONE, 0, "now()", null);
        insertJob(superseded, SUPERSEDED, 0, "now()", null);

        recoverTestPair();

        assertThat(status(done)).isEqualTo(DONE);
        assertThat(status(superseded)).isEqualTo(SUPERSEDED);
    }

    // --- backfill ---------------------------------------------------------------

    @Test
    void backfillCreatesAJobOnlyForCurrentFichesWithoutOne() {
        UUID candidateId = data.candidate(null);
        UUID oldFiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        UUID currentFiche = data.candidateFiche(candidateId, 2, CANDIDATE_CONTENT);
        UUID analysing = data.candidateFiche(data.candidate(null), 1, null);
        UUID offerFiche = data.offerFiche(data.offer(), 1, OFFER_CONTENT);
        UUID alreadyHasAJob = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);
        insertJob(alreadyHasAJob, DONE, 0, "now()", null);

        int created = embeddingService.backfillMissingJobs();

        assertThat(created).isGreaterThanOrEqualTo(2);
        assertThat(jobCount(currentFiche)).isEqualTo(1);
        assertThat(jobCount(offerFiche)).isEqualTo(1);
        assertThat(jobCount(oldFiche)).isZero();
        assertThat(jobCount(analysing)).isZero();
        assertThat(jobCount(alreadyHasAJob)).isEqualTo(1);
        assertThat(status(alreadyHasAJob)).isEqualTo(DONE);
        verify(embeddingExecutor, atLeastOnce()).execute(any(Runnable.class));
    }

    @Test
    void backfillIsIdempotent() {
        UUID fiche = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);

        embeddingService.backfillMissingJobs();
        int secondRun = embeddingService.backfillMissingJobs();

        assertThat(secondRun).isZero();
        assertThat(jobCount(fiche)).isEqualTo(1);
    }

    @Test
    void backfillThenExecutionEmbedsTheFiche() {
        UUID fiche = data.offerFiche(data.offer(), 1, OFFER_CONTENT);

        embeddingService.backfillMissingJobs();
        embeddingWorker.executeJob(jobId(fiche));

        assertThat(status(fiche)).isEqualTo(DONE);
        assertThat(embeddingCount(fiche)).isEqualTo(1);
    }

    private void insertJob(UUID profileId, int status, int attempts, String nextAttemptAt, String startedAt) {
        jdbc.update("INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,"
                + " strategy_version, status, attempts, next_attempt_at, created_at, started_at, error)"
                + " VALUES (?, ?, ?, '1', 'text-1', ?, ?, " + nextAttemptAt + ", now(), "
                + (startedAt == null ? "NULL" : startedAt) + ", " + (status == FAILED ? "'previous error'" : "NULL")
                + ")", UUID.randomUUID(), profileId, EmbeddingTestData.TEST_MODEL, status, attempts);
    }
}
