package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.dto.EmbedResponse;

/**
 * Audit de clôture T-64 sur PostgreSQL réel : un job {@code SUPERSEDED} d'un couple redevenu actif
 * (A→B→A) est relancé par le backfill sans second job ni vecteur perdu (A3), une dimension annoncée
 * fausse n'écrit rien (A4), et le démarrage ne relance que les {@code FAILED} d'un fournisseur épuisé
 * (A5). Service IA et pools simulés, worker piloté à la main ; tout est borné aux fiches créées ici.
 */
class EmbeddingAuditClosureIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CONTENT = """
            {"schemaVersion":"3","title":"Backend Engineer",
             "skills":[{"name":"Java","category":"Programming Languages"}]}""";
    private static final String OTHER_MODEL = "embedding-it-model-b";
    private static final int PENDING = 1;
    private static final int RUNNING = 2;
    private static final int DONE = 3;
    private static final int FAILED = 4;
    private static final int SUPERSEDED = 5;

    @Autowired
    private EmbeddingService embeddingService;
    @Autowired
    private EmbeddingWorker embeddingWorker;
    @Autowired
    private Environment environment;

    private EmbeddingTestData data;

    /** Reprise bornée au couple de test : la base de dev est partagée, jamais une ligne réelle touchée. */
    private void recoverTestPair() {
        embeddingWorker.recoverOrphanJobs(EmbeddingTestData.TEST_MODEL, "1", ProfileTextRenderer.STRATEGY_VERSION);
    }

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        when(embedClient.embed(anyList())).thenAnswer(inv ->
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(EmbeddingTestData.vector(1f, 2f))));
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
        MDC.clear();
    }

    private UUID candidateFiche() {
        return data.candidateFiche(data.candidate(null), 1, CONTENT);
    }

    private void insertJob(UUID profileId, String model, int status, int attempts) {
        jdbc.update("INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,"
                + " strategy_version, status, attempts, next_attempt_at, created_at, completed_at)"
                + " VALUES (?, ?, ?, '1', 'text-1', ?, ?, now(), now(), now())",
                UUID.randomUUID(), profileId, model, status, attempts);
    }

    private void insertVector(UUID profileId, String model) {
        jdbc.update("INSERT INTO profile_embedding (id, normalized_profile_id, embedding, model_name,"
                + " model_version, strategy_version, created_at)"
                + " VALUES (?, ?, CAST(? AS vector), ?, '1', 'text-1', now())", UUID.randomUUID(), profileId,
                EmbeddingWorker.toVectorLiteral(EmbeddingTestData.vector(9f)), model);
    }

    private UUID jobId(UUID profileId) {
        return jdbc.queryForObject("SELECT job_id FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", UUID.class, profileId, EmbeddingTestData.TEST_MODEL);
    }

    private Map<String, Object> job(UUID profileId) {
        return jdbc.queryForMap("SELECT status, attempts, error FROM embedding_job"
                + " WHERE normalized_profile_id = ? AND model_name = ?", profileId, EmbeddingTestData.TEST_MODEL);
    }

    private int status(UUID profileId) {
        return ((Number) job(profileId).get("status")).intValue();
    }

    private int attempts(UUID profileId) {
        return ((Number) job(profileId).get("attempts")).intValue();
    }

    private int jobCount(UUID profileId) {
        return jdbc.queryForObject("SELECT count(*) FROM embedding_job WHERE normalized_profile_id = ?",
                Integer.class, profileId);
    }

    private int vectorCount(UUID profileId, String model) {
        return jdbc.queryForObject("SELECT count(*) FROM profile_embedding WHERE normalized_profile_id = ?"
                + " AND model_name = ?", Integer.class, profileId, model);
    }

    // --- A3 : A→B→A ----------------------------------------------------------------------------

    @Test
    void aSupersededJobOfTheReactivatedPairIsRequeuedByTheBackfillAndEmbeddedExactlyOnce() {
        UUID profileId = candidateFiche();
        // A→B→A : le job du couple A a été écarté (SUPERSEDED) sans vecteur ; B a produit le sien.
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, SUPERSEDED, 0);
        insertJob(profileId, OTHER_MODEL, DONE, 1);
        insertVector(profileId, OTHER_MODEL);
        UUID supersededJobId = jobId(profileId);

        embeddingService.backfillMissingJobs();

        assertThat(jobId(profileId)).isEqualTo(supersededJobId);
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isZero();
        assertThat(jobCount(profileId)).isEqualTo(2);

        embeddingWorker.executeJob(supersededJobId);

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
        // L'ancien vecteur et l'ancien job de B sont conservés.
        assertThat(vectorCount(profileId, OTHER_MODEL)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", Integer.class, profileId, OTHER_MODEL)).isEqualTo(DONE);

        // Rejouer le backfill puis le job n'ajoute ni job ni appel fournisseur.
        embeddingService.backfillMissingJobs();
        embeddingWorker.executeJob(supersededJobId);
        assertThat(jobCount(profileId)).isEqualTo(2);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
        verify(embedClient, times(1)).embed(anyList());
    }

    @Test
    void aSupersededJobWhoseVectorAlreadyExistsIsNotRequeued() {
        UUID profileId = candidateFiche();
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, SUPERSEDED, 0);
        insertVector(profileId, EmbeddingTestData.TEST_MODEL);

        embeddingService.backfillMissingJobs();

        assertThat(status(profileId)).isEqualTo(SUPERSEDED);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
    }

    @Test
    void aSupersededJobOnAFicheThatIsNoLongerCurrentIsNotRequeued() {
        UUID candidateId = data.candidate(null);
        UUID oldFiche = data.candidateFiche(candidateId, 1, CONTENT);
        UUID currentFiche = data.candidateFiche(candidateId, 2, CONTENT);
        insertJob(oldFiche, EmbeddingTestData.TEST_MODEL, SUPERSEDED, 0);

        embeddingService.backfillMissingJobs();

        assertThat(status(oldFiche)).isEqualTo(SUPERSEDED);
        assertThat(jobCount(currentFiche)).isEqualTo(1);
    }

    @Test
    void aFicheOnlySupersededUnderAnotherPairGetsItsJobCreated() {
        UUID profileId = candidateFiche();
        insertJob(profileId, OTHER_MODEL, SUPERSEDED, 0);

        embeddingService.backfillMissingJobs();

        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(jobCount(profileId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT status FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", Integer.class, profileId, OTHER_MODEL)).isEqualTo(SUPERSEDED);
    }

    @ParameterizedTest
    @ValueSource(ints = { PENDING, RUNNING, DONE, FAILED })
    void backfillLeavesEveryOtherJobStatusAlone(int existingStatus) {
        UUID profileId = candidateFiche();
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, existingStatus, 2);

        embeddingService.backfillMissingJobs();

        assertThat(status(profileId)).isEqualTo(existingStatus);
        assertThat(attempts(profileId)).isEqualTo(2);
        assertThat(jobCount(profileId)).isEqualTo(1);
    }

    @Test
    void theNormalizationTriggerNeverRevivesASupersededJob() {
        UUID profileId = candidateFiche();
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, SUPERSEDED, 0);

        embeddingService.enqueueAndDispatch(profileId);

        assertThat(status(profileId)).isEqualTo(SUPERSEDED);
        assertThat(jobCount(profileId)).isEqualTo(1);
    }

    @Test
    void twoConcurrentBackfillsRequeueTheSupersededJobOnceAndEmbedItOnce() throws Exception {
        UUID profileId = candidateFiche();
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, SUPERSEDED, 0);
        UUID supersededJobId = jobId(profileId);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService threads = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = threads.submit(() -> {
                start.await();
                return embeddingService.backfillMissingJobs();
            });
            Future<?> second = threads.submit(() -> {
                start.await();
                return embeddingService.backfillMissingJobs();
            });
            start.countDown();
            first.get(60, TimeUnit.SECONDS);
            second.get(60, TimeUnit.SECONDS);
        } finally {
            threads.shutdownNow();
        }

        assertThat(jobCount(profileId)).isEqualTo(1);
        embeddingWorker.executeJob(supersededJobId);
        embeddingWorker.executeJob(supersededJobId);
        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
        verify(embedClient, times(1)).embed(anyList());
    }

    // --- A4 : dimension annoncée --------------------------------------------------------------

    @Test
    void aWrongDeclaredDimensionWritesNothingAndLeavesTheJobToRetry() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenReturn(new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1535,
                List.of(EmbeddingTestData.vector(1f))));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isZero();
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isEqualTo(1);
        assertThat((String) job(profileId).get("error")).contains("1535");
    }

    // --- A5 : discrimination des FAILED au démarrage --------------------------------------------

    @Test
    void aDeterministicFailureOnTheFirstTryStaysFailedAtBoot() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, "{}");
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));
        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(1);
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aNotRenderableFicheAfterTwoTechnicalFailuresStaysFailedAtBoot() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("provider down"));
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);
        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isEqualTo(2);
        // La fiche devient non représentable avant la 3ᵉ exécution : échec définitif, compteur à 3.
        jdbc.update("UPDATE normalized_profile SET content = CAST('{}' AS jsonb) WHERE normalized_profile_id = ?",
                profileId);

        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(EmbeddingWorker.MAX_ATTEMPTS);
        recoverTestPair();
        assertThat(status(profileId)).isEqualTo(FAILED);
        verify(embedClient, times(2)).embed(anyList());
    }

    @Test
    void anExhaustedProviderIsRequeuedAtBootWithoutASecondLine() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("provider down"));
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);
        for (int i = 0; i < EmbeddingWorker.MAX_ATTEMPTS; i++) {
            embeddingWorker.executeJob(jobId);
        }
        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(EmbeddingWorker.MAX_ATTEMPTS);

        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isZero();
        assertThat(jobCount(profileId)).isEqualTo(1);
        verify(embedClient, times(EmbeddingWorker.MAX_ATTEMPTS)).embed(anyList());
    }

    // --- C1 : un vecteur de norme nulle n'atteint jamais profile_embedding --------------------------

    @Test
    void aZeroVectorIsRetriedThenFailedAndNeverStored() {
        UUID profileId = candidateFiche();
        when(embedClient.embed(anyList())).thenReturn(new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536,
                List.of(EmbeddingTestData.vector())));
        embeddingService.enqueueAndDispatch(profileId);
        UUID jobId = jobId(profileId);

        embeddingWorker.executeJob(jobId);
        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isEqualTo(1);
        embeddingWorker.executeJob(jobId);
        embeddingWorker.executeJob(jobId);

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(EmbeddingWorker.MAX_ATTEMPTS);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isZero();
        assertThat((String) job(profileId).get("error")).contains("null or non-normalizable");
        verify(embedClient, times(EmbeddingWorker.MAX_ATTEMPTS)).embed(anyList());
    }

    @Test
    void aVectorWithASingleNonZeroComponentIsStored() {
        UUID profileId = candidateFiche();
        float[] sparse = EmbeddingTestData.vector();
        sparse[1535] = 1e-30f;
        when(embedClient.embed(anyList())).thenReturn(
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(sparse)));
        embeddingService.enqueueAndDispatch(profileId);

        embeddingWorker.executeJob(jobId(profileId));

        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
    }

    // --- C3 : reprise bornée au couple de test, base partagée intacte --------------------------------

    private void insertJobStartedAt(UUID profileId, String model, int status, int attempts, String startedAtSql) {
        jdbc.update("INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,"
                + " strategy_version, status, attempts, next_attempt_at, created_at, started_at, error)"
                + " VALUES (?, ?, ?, '1', 'text-1', ?, ?, now() - interval '1 hour', now() - interval '1 hour', "
                + startedAtSql + ", ?)", UUID.randomUUID(), profileId, model, status, attempts,
                status == FAILED ? "previous error" : null);
    }

    private List<Map<String, Object>> foreignJobs() {
        return jdbc.queryForList("SELECT job_id, normalized_profile_id, model_name, status, attempts, error,"
                + " next_attempt_at, started_at, completed_at FROM embedding_job WHERE model_name <> ?"
                + " ORDER BY job_id", EmbeddingTestData.TEST_MODEL);
    }

    private List<Map<String, Object>> foreignVectors() {
        return jdbc.queryForList("SELECT id, normalized_profile_id, model_name, model_version, strategy_version,"
                + " created_at FROM profile_embedding WHERE model_name <> ? ORDER BY id",
                EmbeddingTestData.TEST_MODEL);
    }

    private List<Map<String, Object>> testUsers() {
        return jdbc.queryForList("SELECT id, email, status, updated_at FROM users"
                + " WHERE email LIKE 'embedding-it-%' ORDER BY id");
    }

    @Test
    void aFailedJobOfTheTestPairWithARenderableFicheIsRequeuedExecutedAndStoredOnce() {
        UUID profileId = candidateFiche();
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, FAILED, 3);
        UUID jobId = jobId(profileId);

        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(PENDING);
        assertThat(attempts(profileId)).isZero();
        embeddingWorker.executeJob(jobId);
        assertThat(status(profileId)).isEqualTo(DONE);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isEqualTo(1);
        assertThat(jobCount(profileId)).isEqualTo(1);
        verify(embedClient, times(1)).embed(anyList());
    }

    @Test
    void aFailedJobOfTheTestPairWithANotRenderableFicheStaysFailedWithoutAVector() {
        UUID profileId = data.candidateFiche(data.candidate(null), 1, "{}");
        insertJob(profileId, EmbeddingTestData.TEST_MODEL, FAILED, 3);
        UUID jobId = jobId(profileId);

        recoverTestPair();

        assertThat(status(profileId)).isEqualTo(FAILED);
        assertThat(attempts(profileId)).isEqualTo(3);
        assertThat(jobId(profileId)).isEqualTo(jobId);
        assertThat(vectorCount(profileId, EmbeddingTestData.TEST_MODEL)).isZero();
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void aFailedJobOfAnotherPairIsNeverRequeued() {
        UUID profileId = candidateFiche();
        insertJob(profileId, OTHER_MODEL, FAILED, 3);
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", profileId, OTHER_MODEL);

        recoverTestPair();

        assertThat(jdbc.queryForMap("SELECT * FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", profileId, OTHER_MODEL)).isEqualTo(before);
        verify(embeddingExecutor, never()).execute(any(Runnable.class));
    }

    @Test
    void theScopedRecoveryLeavesEveryRowOutsideItsPairStrictlyIdentical() {
        // Des jobs d'un autre couple dans tous les états que la reprise sait traiter, sur des fiches
        // représentables : FAILED épuisé, PENDING échu, RUNNING périmé.
        insertJobStartedAt(candidateFiche(), OTHER_MODEL, FAILED, 3, "NULL");
        insertJobStartedAt(candidateFiche(), OTHER_MODEL, PENDING, 0, "NULL");
        insertJobStartedAt(candidateFiche(), OTHER_MODEL, RUNNING, 0, "now() - interval '1 hour'");
        // Et un job FAILED épuisé du couple de test, qui, lui, doit être repris.
        UUID mine = candidateFiche();
        insertJob(mine, EmbeddingTestData.TEST_MODEL, FAILED, 3);
        List<Map<String, Object>> jobsBefore = foreignJobs();
        List<Map<String, Object>> vectorsBefore = foreignVectors();
        List<Map<String, Object>> usersBefore = testUsers();
        assertThat(jobsBefore).isNotEmpty();

        recoverTestPair();

        assertThat(foreignJobs()).isEqualTo(jobsBefore);
        assertThat(foreignVectors()).isEqualTo(vectorsBefore);
        assertThat(testUsers()).isEqualTo(usersBefore);
        assertThat(status(mine)).isEqualTo(PENDING);
        // Seul le job du couple de test a été soumis ; aucun appel au fournisseur.
        verify(embeddingExecutor, times(1)).execute(any(Runnable.class));
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void noTestContextRunsTheBootRecoveryAgainstTheSharedDatabase() {
        assertThat(environment.getProperty("app.embedding.recovery-on-boot", Boolean.class)).isFalse();
    }
}
