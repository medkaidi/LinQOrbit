package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.linqorbit.candidate.client.ProfileNormalizeClient;
import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.dto.EmbedResponse;
import com.linqorbit.joboffer.client.JobOfferNormalizeClient;

/**
 * Chaînage réel normalisation → embedding (T-64), sans mocker le service
 * d'embedding : la fin d'une normalisation crée le job du couple actif, le
 * worker d'embedding l'exécute et le vecteur est écrit pour la bonne fiche.
 * Complète les ITs des workers de normalisation (qui vérifient l'appel du
 * déclencheur) en prouvant que l'identifiant transmis est exploitable.
 * Seuls le service IA et les pools sont simulés ; les pools de normalisation
 * le sont aussi pour que le recovery au démarrage ne touche pas aux jobs de
 * la base partagée.
 */
class NormalizationEmbeddingChainIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CANDIDATE_JSON = """
            {"schemaVersion": "3", "title": "Backend Engineer",
             "skills": [{"name": "Java", "category": "Programming Languages"}]}""";
    private static final String OFFER_JSON = """
            {"schemaVersion": "2", "title": "Java Developer",
             "requiredSkills": [{"name": "Java", "category": "Programming Languages"}], "preferredSkills": []}""";

    @Autowired
    private NormalizationWorker normalizationWorker;

    @MockitoBean
    private ProfileNormalizeClient profileNormalizeClient;
    @MockitoBean
    private JobOfferNormalizeClient jobOfferNormalizeClient;
    @MockitoBean(name = "normalizationExecutor")
    private ThreadPoolTaskExecutor normalizationExecutor;
    @MockitoBean(name = "normalizationTaskScheduler")
    private TaskScheduler normalizationTaskScheduler;

    private EmbeddingTestData data;
    private final List<UUID> normalizationJobIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        when(embedClient.embed(anyList())).thenAnswer(inv ->
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(EmbeddingTestData.vector(1f))));
        // Le pool d'embedding exécute aussitôt : toute la chaîne se déroule dans le thread du test.
        doAnswer(inv -> {
            ((Runnable) inv.getArgument(0)).run();
            return null;
        }).when(embeddingExecutor).execute(any(Runnable.class));
    }

    @AfterEach
    void cleanup() {
        for (UUID jobId : normalizationJobIds) {
            jdbc.update("DELETE FROM normalization_job WHERE job_id = ?", jobId);
        }
        normalizationJobIds.clear();
        data.cleanup();
    }

    /** Fiche sans contenu et son job de normalisation PENDING (source 1 = candidat, 2 = offre). */
    private UUID pendingNormalization(UUID profileId, int sourceType) {
        jdbc.update("""
                INSERT INTO normalization_job
                    (job_id, status, source_type, attempts, next_attempt_at, error, created_at, started_at)
                VALUES (?, 1, ?, 0, ?, NULL, ?, NULL)""", profileId, sourceType, LocalDateTime.now(),
                LocalDateTime.now());
        normalizationJobIds.add(profileId);
        return profileId;
    }

    private int embeddingJobStatus(UUID profileId) {
        return jdbc.queryForObject("SELECT status FROM embedding_job WHERE normalized_profile_id = ?"
                + " AND model_name = ?", Integer.class, profileId, EmbeddingTestData.TEST_MODEL);
    }

    private int embeddingJobCount(UUID profileId) {
        return jdbc.queryForObject("SELECT count(*) FROM embedding_job WHERE normalized_profile_id = ?",
                Integer.class, profileId);
    }

    private int vectorCount(UUID profileId) {
        return jdbc.queryForObject("SELECT count(*) FROM profile_embedding WHERE normalized_profile_id = ?",
                Integer.class, profileId);
    }

    @Test
    void aNormalizedCandidateIsEmbeddedByTheChainWithTheCandidateRendering() {
        UUID candidateId = data.candidate(null);
        UUID profileId = pendingNormalization(data.candidateFiche(candidateId, 1, null), 1);
        when(profileNormalizeClient.normalize(any())).thenReturn(CANDIDATE_JSON);

        normalizationWorker.executeJob(profileId);

        assertThat(embeddingJobStatus(profileId)).isEqualTo(3);
        assertThat(vectorCount(profileId)).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> texts = ArgumentCaptor.forClass(List.class);
        verify(embedClient).embed(texts.capture());
        assertThat(texts.getValue().get(0)).startsWith("Candidate profile\n").contains("Backend Engineer");
    }

    @Test
    void aNormalizedOfferIsEmbeddedByTheChainWithTheOfferRendering() {
        UUID offerId = data.offer();
        UUID profileId = pendingNormalization(data.offerFiche(offerId, 1, null), 2);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(OFFER_JSON);

        normalizationWorker.executeJob(profileId);

        assertThat(embeddingJobStatus(profileId)).isEqualTo(3);
        assertThat(vectorCount(profileId)).isEqualTo(1);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> texts = ArgumentCaptor.forClass(List.class);
        verify(embedClient).embed(texts.capture());
        assertThat(texts.getValue().get(0)).startsWith("Job offer\n").contains("Java Developer");
    }

    @Test
    void aFailedNormalizationCreatesNoEmbeddingJobAtAll() {
        UUID candidateId = data.candidate(null);
        UUID profileId = pendingNormalization(data.candidateFiche(candidateId, 1, null), 1);
        when(profileNormalizeClient.normalize(any())).thenReturn("{\"schemaVersion\": \"1\"}");

        normalizationWorker.executeJob(profileId);

        assertThat(embeddingJobCount(profileId)).isZero();
        assertThat(vectorCount(profileId)).isZero();
        verify(embedClient, never()).embed(anyList());
    }

    @Test
    void onlyTheCurrentFicheIsEmbeddedWhenTheCandidateIsRevalidatedBeforeTheFirstEmbeddingRuns() {
        UUID candidateId = data.candidate(null);
        UUID first = pendingNormalization(data.candidateFiche(candidateId, 1, null), 1);
        UUID second = pendingNormalization(data.candidateFiche(candidateId, 2, null), 1);
        when(profileNormalizeClient.normalize(any())).thenReturn(CANDIDATE_JSON);
        // Le pool d'embedding diffère l'exécution : les deux fiches sont normalisées avant tout embedding.
        List<Runnable> deferred = new ArrayList<>();
        doAnswer(inv -> {
            deferred.add(inv.getArgument(0));
            return null;
        }).when(embeddingExecutor).execute(any(Runnable.class));

        normalizationWorker.executeJob(first);
        normalizationWorker.executeJob(second);
        assertThat(deferred).hasSize(2);
        deferred.forEach(Runnable::run);

        // v1 n'est plus la fiche courante : aucun appel au fournisseur, aucun vecteur.
        assertThat(embeddingJobStatus(first)).isEqualTo(5);
        assertThat(vectorCount(first)).isZero();
        assertThat(embeddingJobStatus(second)).isEqualTo(3);
        assertThat(vectorCount(second)).isEqualTo(1);
        verify(embedClient, times(1)).embed(anyList());
    }

    @Test
    void aProviderOutageNeverChangesTheNormalizationResultOfTheChain() {
        UUID candidateId = data.candidate(null);
        UUID profileId = pendingNormalization(data.candidateFiche(candidateId, 1, null), 1);
        when(profileNormalizeClient.normalize(any())).thenReturn(CANDIDATE_JSON);
        when(embedClient.embed(anyList())).thenThrow(new IllegalStateException("provider down"));

        normalizationWorker.executeJob(profileId);

        assertThat(jdbc.queryForObject("SELECT status FROM normalization_job WHERE job_id = ?", Integer.class,
                profileId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT content IS NOT NULL FROM normalized_profile"
                + " WHERE normalized_profile_id = ?", Boolean.class, profileId)).isTrue();
        assertThat(embeddingJobStatus(profileId)).isEqualTo(1);
        assertThat(vectorCount(profileId)).isZero();
        verify(profileNormalizeClient, times(1)).normalize(any());
    }
}
