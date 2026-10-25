package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;
import com.linqorbit.embedding.dto.EmbedResponse;

/**
 * Chaînage embedding → recherche de candidats (T-101) : la fin de
 * l'embedding de la fiche d'une offre <b>publiée</b> crée (ou libère) son job
 * de screening et le soumet ; rien pour un candidat, une offre non publiée, un
 * embedding en échec ou écarté.
 */
class EmbeddingScreeningChainIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Java Developer\"}";
    private static final String CANDIDATE_CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Backend Engineer\"}";

    @Autowired
    private EmbeddingService embeddingService;
    @Autowired
    private EmbeddingWorker embeddingWorker;

    private EmbeddingTestData data;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        when(embedClient.embed(anyList())).thenReturn(
                new EmbedResponse(EmbeddingTestData.TEST_MODEL, 1536, List.of(EmbeddingTestData.vector(1f, 2f))));
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private void embed(UUID profileId) {
        embeddingService.enqueueAndDispatch(profileId);
        embeddingWorker.executeJob(jdbc.queryForObject(
                "SELECT job_id FROM embedding_job WHERE normalized_profile_id = ? AND model_name = ?", UUID.class,
                profileId, EmbeddingTestData.TEST_MODEL));
    }

    private int screeningJobs(UUID offerId) {
        return jdbc.queryForObject("SELECT count(*) FROM screening_job WHERE job_offer_id = ?", Integer.class,
                offerId);
    }

    @Test
    void thePublishedOffersEmbeddingCreatesAndSubmitsItsScreeningJob() {
        OfferFixture offer = data.publishedOffer();
        UUID fiche = data.offerFiche(offer.offerId(), 1, OFFER_CONTENT);

        embed(fiche);

        assertThat(screeningJobs(offer.offerId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM screening_job WHERE job_offer_id = ?", Integer.class,
                offer.offerId())).isEqualTo(1);
        verify(screeningExecutor).execute(org.mockito.ArgumentMatchers.any(Runnable.class));
    }

    @Test
    void theEmbeddingReleasesTheJobThatPublicationLeftWaiting() {
        OfferFixture offer = data.publishedOffer();
        UUID fiche = data.offerFiche(offer.offerId(), 1, OFFER_CONTENT);
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, created_at)
                VALUES (?, ?, ?, 1, 0, now(), now())""", UUID.randomUUID(), offer.offerId(), fiche);

        embed(fiche);

        assertThat(screeningJobs(offer.offerId())).isEqualTo(1);
        verify(screeningExecutor).execute(org.mockito.ArgumentMatchers.any(Runnable.class));
    }

    @Test
    void aCandidateFicheNeverStartsAScreening() {
        UUID fiche = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);

        embed(fiche);

        verify(screeningExecutor, never()).execute(org.mockito.ArgumentMatchers.any(Runnable.class));
    }

    @Test
    void anUnpublishedOffersEmbeddingStartsNoScreening() {
        OfferFixture draft = data.offer(EmbeddingTestData.DRAFT, null);
        UUID fiche = data.offerFiche(draft.offerId(), 1, OFFER_CONTENT);

        embed(fiche);

        assertThat(screeningJobs(draft.offerId())).isZero();
    }

    @Test
    void aFailedEmbeddingStartsNoScreening() {
        OfferFixture offer = data.publishedOffer();
        UUID fiche = data.offerFiche(offer.offerId(), 1, OFFER_CONTENT);
        when(embedClient.embed(anyList())).thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "down"));

        embed(fiche);

        assertThat(screeningJobs(offer.offerId())).isZero();
    }

    @Test
    void aSupersededEmbeddingStartsNoScreening() {
        OfferFixture offer = data.publishedOffer();
        UUID oldFiche = data.offerFiche(offer.offerId(), 1, OFFER_CONTENT);
        data.offerFiche(offer.offerId(), 2, OFFER_CONTENT);

        embed(oldFiche);

        assertThat(screeningJobs(offer.offerId())).isZero();
    }
}
