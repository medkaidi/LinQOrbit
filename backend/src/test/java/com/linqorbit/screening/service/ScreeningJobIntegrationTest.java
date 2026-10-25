package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;

/**
 * Recherche automatique de candidats à la publication (T-101, D85) sur
 * PostgreSQL réel : cycle du job (déclencheurs, exécution, snapshot, échec,
 * relance, reprise au démarrage), signaux d'affichage du détail et de la liste,
 * flux SSE et droits de la relance. Les pools sont inertes (contexte partagé) :
 * le worker est piloté à la main, la base seule fait foi.
 */
class ScreeningJobIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CANDIDATE_CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Engineer\"}";
    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";
    private static final int PENDING = 1;
    private static final int RUNNING = 2;
    private static final int DONE = 3;
    private static final int FAILED = 4;
    private static final int SUPERSEDED = 5;

    @Autowired
    private ScreeningJobService screeningJobService;
    @Autowired
    private ScreeningWorker screeningWorker;
    @Autowired
    private MockMvc mockMvc;

    private EmbeddingTestData data;
    private OfferFixture offer;
    private UUID offerId;
    private UUID offerFiche;
    private boolean offerVectorWritten;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        offer = data.publishedOffer();
        offerId = offer.offerId();
        offerFiche = data.offerFiche(offerId, 1, OFFER_CONTENT);
        offerVectorWritten = false;
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    // --- aides ---------------------------------------------------------------------

    /** Vecteur de la fiche courante de l'offre (idempotent : un seul vecteur par couple). */
    private void offerVector() {
        if (!offerVectorWritten) {
            data.embedding(offerFiche, 1f, 0f);
            offerVectorWritten = true;
        }
    }

    private UUID candidateAt(Integer searchStatus, float... vector) {
        UUID candidateId = data.candidate(searchStatus);
        data.embedding(data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT), vector);
        return candidateId;
    }

    /** N candidats éligibles, de plus en plus éloignés de la direction de l'offre. */
    private List<UUID> candidates(int count) {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ids.add(candidateAt(null, 1f, 0.05f * (i + 1)));
        }
        return ids;
    }

    private List<UUID> jobIds() {
        return jdbc.queryForList("SELECT job_id FROM screening_job WHERE job_offer_id = ? ORDER BY created_at, job_id",
                UUID.class, offerId);
    }

    private UUID onlyJob() {
        assertThat(jobIds()).hasSize(1);
        return jobIds().get(0);
    }

    private int statusOf(UUID jobId) {
        return jdbc.queryForObject("SELECT status FROM screening_job WHERE job_id = ?", Integer.class, jobId);
    }

    private Integer countOf(UUID jobId) {
        return jdbc.queryForObject("SELECT candidate_count FROM screening_job WHERE job_id = ?", Integer.class,
                jobId);
    }

    private int attemptsOf(UUID jobId) {
        return jdbc.queryForObject("SELECT attempts FROM screening_job WHERE job_id = ?", Integer.class, jobId);
    }

    private void setStatus(UUID jobId, int status) {
        jdbc.update("UPDATE screening_job SET status = ? WHERE job_id = ?", status, jobId);
    }

    private List<UUID> suggestedCandidates() {
        return jdbc.queryForList("SELECT candidate_id FROM offer_candidate WHERE job_offer_id = ? ORDER BY rank",
                UUID.class, offerId);
    }

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    /** Offre publiée avec vecteur, job créé par le déclencheur de publication, puis exécuté. */
    private UUID publishAndRun() {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        screeningWorker.executeJob(jobId);
        return jobId;
    }

    // --- déclencheurs ----------------------------------------------------------------

    @Test
    void publicationWithTheOfferVectorCreatesAReadyJobAndSubmitsIt() {
        offerVector();

        screeningJobService.onPublished(offerId);

        assertThat(statusOf(onlyJob())).isEqualTo(PENDING);
        assertThat(countOf(onlyJob())).isNull();
        verify(screeningExecutor).execute(any(Runnable.class));
    }

    @Test
    void publicationWithoutTheOfferVectorWaitsForTheEmbeddingThenEmbeddingDoneReleasesIt() {
        screeningJobService.onPublished(offerId);

        UUID jobId = onlyJob();
        assertThat(statusOf(jobId)).isEqualTo(PENDING);
        verify(screeningExecutor, never()).execute(any(Runnable.class));

        offerVector();
        screeningJobService.onOfferEmbeddingDone(offerFiche);

        assertThat(jobIds()).containsExactly(jobId);
        verify(screeningExecutor).execute(any(Runnable.class));
    }

    @Test
    void publicationWithoutAnyAnalysisCreatesNoJobAndTheEmbeddingOfTheFirstFicheCreatesIt() {
        OfferFixture bare = data.publishedOffer();

        screeningJobService.onPublished(bare.offerId());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM screening_job WHERE job_offer_id = ?", Integer.class,
                bare.offerId())).isZero();

        UUID fiche = data.offerFiche(bare.offerId(), 1, OFFER_CONTENT);
        data.embedding(fiche, 1f, 0f);
        screeningJobService.onOfferEmbeddingDone(fiche);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM screening_job WHERE job_offer_id = ?", Integer.class,
                bare.offerId())).isEqualTo(1);
        verify(screeningExecutor).execute(any(Runnable.class));
    }

    @Test
    void embeddingDoneForAnUnpublishedOrExpiredOrCandidateProfileDoesNothing() {
        OfferFixture draft = data.offer(EmbeddingTestData.DRAFT, null);
        UUID draftFiche = data.offerFiche(draft.offerId(), 1, OFFER_CONTENT);
        OfferFixture expired = data.offer(EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        UUID expiredFiche = data.offerFiche(expired.offerId(), 1, OFFER_CONTENT);
        UUID candidateFiche = data.candidateFiche(data.candidate(null), 1, CANDIDATE_CONTENT);

        screeningJobService.onOfferEmbeddingDone(draftFiche);
        screeningJobService.onOfferEmbeddingDone(expiredFiche);
        screeningJobService.onOfferEmbeddingDone(candidateFiche);
        screeningJobService.onOfferEmbeddingDone(UUID.randomUUID());

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM screening_job WHERE job_offer_id IN (?, ?)""", Integer.class,
                draft.offerId(), expired.offerId())).isZero();
        verify(screeningExecutor, never()).execute(any(Runnable.class));
    }

    @Test
    void twoTriggersForTheSameFicheNeverCreateTwoJobs() {
        offerVector();

        screeningJobService.onPublished(offerId);
        screeningJobService.onOfferEmbeddingDone(offerFiche);
        screeningJobService.onOfferEmbeddingDone(offerFiche);

        assertThat(jobIds()).hasSize(1);
    }

    // --- exécution ---------------------------------------------------------------------

    @Test
    void theTopNIsStoredRankedByDistanceAndOnlyEligibleCandidatesAppear() {
        offerVector();
        UUID notLooking = candidateAt(EmbeddingTestData.NOT_LOOKING, 1f, 0f);
        UUID alreadyApplied = candidateAt(null, 1f, 0f);
        data.application(alreadyApplied, offerId, 2);
        UUID draftApplicant = candidateAt(null, 1f, 0.001f);
        data.application(draftApplicant, offerId, 1);
        List<UUID> eligible = candidates(12);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(DONE);
        assertThat(countOf(jobId)).isEqualTo(10);
        assertThat(suggestedCandidates()).containsExactlyElementsOf(eligible.subList(0, 10))
                .doesNotContain(notLooking, alreadyApplied, draftApplicant);
        assertThat(jdbc.queryForList("SELECT rank FROM offer_candidate WHERE job_offer_id = ? ORDER BY rank",
                Integer.class, offerId)).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM offer_candidate
                WHERE job_offer_id = ? AND status = 1 AND invited_by_user_id IS NULL AND invited_at IS NULL
                  AND screening_job_id = ?""", Integer.class, offerId, jobId)).isEqualTo(10);
    }

    @Test
    void theStoredRowCarriesTheFicheThatWasCompared() {
        offerVector();
        UUID candidateId = data.candidate(null);
        UUID fiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.embedding(fiche, 1f, 0f);

        publishAndRun();

        assertThat(jdbc.queryForObject("""
                SELECT candidate_normalized_profile_id FROM offer_candidate
                WHERE job_offer_id = ? AND candidate_id = ?""", UUID.class, offerId, candidateId)).isEqualTo(fiche);
    }

    @Test
    void fewerCandidatesThanNAreAllKept() {
        offerVector();
        List<UUID> all = candidates(3);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(DONE);
        assertThat(countOf(jobId)).isEqualTo(3);
        assertThat(suggestedCandidates()).containsExactlyElementsOf(all);
    }

    @Test
    void noCandidateAtAllIsADoneSearchWithAZeroCountNotAMissingOne() {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(DONE);
        assertThat(countOf(jobId)).isZero();
        assertThat(suggestedCandidates()).isEmpty();
    }

    @Test
    void anOfferClosedOrExpiredBeforeTheRunIsSupersededWithoutAnySuggestion() {
        offerVector();
        candidates(2);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        data.setOfferStatus(offerId, EmbeddingTestData.CLOSED, null);

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(SUPERSEDED);
        assertThat(suggestedCandidates()).isEmpty();

        OfferFixture expired = data.publishedOffer();
        UUID expiredFiche = data.offerFiche(expired.offerId(), 1, OFFER_CONTENT);
        data.embedding(expiredFiche, 1f, 0f);
        screeningJobService.onPublished(expired.offerId());
        UUID expiredJob = jdbc.queryForObject("SELECT job_id FROM screening_job WHERE job_offer_id = ?", UUID.class,
                expired.offerId());
        data.setOfferStatus(expired.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));

        screeningWorker.executeJob(expiredJob);

        assertThat(statusOf(expiredJob)).isEqualTo(SUPERSEDED);
    }

    @Test
    void aFicheNoLongerCurrentIsSupersededWithoutComputation() {
        offerVector();
        candidates(2);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        data.offerFiche(offerId, 2, OFFER_CONTENT);

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(SUPERSEDED);
        assertThat(suggestedCandidates()).isEmpty();
    }

    @Test
    void aJobWithoutTheOfferVectorGoesBackToPendingWithoutConsumingAnAttempt() {
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(PENDING);
        assertThat(attemptsOf(jobId)).isZero();
        assertThat(suggestedCandidates()).isEmpty();
    }

    @Test
    void anAlreadyClaimedJobIsNotExecutedTwice() {
        offerVector();
        candidates(2);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        screeningWorker.executeJob(jobId);
        assertThat(statusOf(jobId)).isEqualTo(DONE);
        List<UUID> before = jdbc.queryForList("SELECT id FROM offer_candidate WHERE job_offer_id = ?", UUID.class,
                offerId);

        screeningWorker.executeJob(jobId);

        assertThat(jdbc.queryForList("SELECT id FROM offer_candidate WHERE job_offer_id = ?", UUID.class, offerId))
                .containsExactlyInAnyOrderElementsOf(before);
    }

    // --- instantané ----------------------------------------------------------------------

    @Test
    void aNewFicheNeverRefreshesAnOfferThatAlreadyHasItsSnapshot() {
        UUID jobId = publishAndRun();
        assertThat(statusOf(jobId)).isEqualTo(DONE);
        UUID newFiche = data.offerFiche(offerId, 2, OFFER_CONTENT);
        data.embedding(newFiche, 1f, 0f);

        screeningJobService.onOfferEmbeddingDone(newFiche);

        assertThat(jobIds()).containsExactly(jobId);
        assertThat(statusOf(jobId)).isEqualTo(DONE);
    }

    @Test
    void aNewFicheSupersedesTheWaitingJobOfThePreviousOne() {
        screeningJobService.onPublished(offerId);
        UUID first = onlyJob();
        UUID newFiche = data.offerFiche(offerId, 2, OFFER_CONTENT);
        data.embedding(newFiche, 1f, 0f);

        screeningJobService.onOfferEmbeddingDone(newFiche);

        List<UUID> jobs = jobIds();
        assertThat(jobs).hasSize(2).contains(first);
        UUID second = jobs.stream().filter(id -> !id.equals(first)).findFirst().orElseThrow();
        assertThat(statusOf(first)).isEqualTo(SUPERSEDED);
        assertThat(statusOf(second)).isEqualTo(PENDING);
    }

    // --- échec et relance --------------------------------------------------------------------

    @Test
    void threeFailedExecutionsEndInFailedAndTheErrorIsKept() {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        doThrow(new IllegalStateException("boom")).when(screeningServiceSpy).topCandidates(any(UUID.class));

        screeningWorker.executeJob(jobId);
        assertThat(statusOf(jobId)).isEqualTo(PENDING);
        assertThat(attemptsOf(jobId)).isEqualTo(1);
        screeningWorker.executeJob(jobId);
        assertThat(statusOf(jobId)).isEqualTo(PENDING);
        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(FAILED);
        assertThat(attemptsOf(jobId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT error FROM screening_job WHERE job_id = ?", String.class, jobId))
                .isNotBlank();
        assertThat(suggestedCandidates()).isEmpty();
        assertThat(countOf(jobId)).isNull();
    }

    @Test
    void aFailedExecutionRollsBackItsPartialWork() {
        offerVector();
        UUID invited = candidateAt(null, 1f, 0.1f);
        candidates(2);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        screeningWorker.executeJob(jobId);
        // Un SUGGESTED existe ; l'échec suivant ne doit pas les avoir effacés avant de lever.
        setStatus(jobId, PENDING);
        List<UUID> before = suggestedCandidates();
        doThrow(new IllegalStateException("boom")).when(screeningServiceSpy).topCandidates(any(UUID.class));

        screeningWorker.executeJob(jobId);

        assertThat(suggestedCandidates()).containsExactlyElementsOf(before);
        assertThat(before).contains(invited);
    }

    @Test
    void retryRequeuesAFailedSearchWithItsAttemptsResetAndRerunsKeepingInvitations() throws Exception {
        offerVector();
        List<UUID> all = candidates(3);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        screeningWorker.executeJob(jobId);
        UUID invitedRow = jdbc.queryForObject("SELECT id FROM offer_candidate WHERE candidate_id = ?", UUID.class,
                all.get(0));
        jdbc.update("""
                UPDATE offer_candidate SET status = 2, invited_by_user_id = ?, invited_at = now() WHERE id = ?""",
                offer.creatorId(), invitedRow);
        List<UUID> suggestedRowsBefore = jdbc.queryForList(
                "SELECT id FROM offer_candidate WHERE job_offer_id = ? AND status = 1", UUID.class, offerId);
        jdbc.update("UPDATE screening_job SET status = ?, attempts = 3, error = 'boom' WHERE job_id = ?", FAILED,
                jobId);
        clearInvocations(screeningExecutor);

        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(offer.creatorId())))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("pending"))
                .andExpect(jsonPath("$.candidateCount").doesNotExist());

        assertThat(statusOf(jobId)).isEqualTo(PENDING);
        assertThat(attemptsOf(jobId)).isZero();
        assertThat(jobIds()).containsExactly(jobId);
        verify(screeningExecutor).execute(any(Runnable.class));

        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(DONE);
        assertThat(countOf(jobId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT status FROM offer_candidate WHERE id = ?", Integer.class,
                invitedRow)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM offer_candidate WHERE candidate_id = ?", Integer.class,
                all.get(0))).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT id FROM offer_candidate WHERE job_offer_id = ? AND status = 1",
                UUID.class, offerId)).doesNotContainAnyElementsOf(suggestedRowsBefore).hasSize(2);
    }

    @Test
    void retryAfterAnInfrastructureFailureEndsInDoneOnceTheFaultIsGone() throws Exception {
        offerVector();
        candidates(2);
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        doThrow(new IllegalStateException("boom")).when(screeningServiceSpy).topCandidates(any(UUID.class));
        for (int i = 0; i < 3; i++) {
            screeningWorker.executeJob(jobId);
        }
        assertThat(statusOf(jobId)).isEqualTo(FAILED);
        doCallRealMethod().when(screeningServiceSpy).topCandidates(any(UUID.class));

        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(offer.creatorId())))
                .andExpect(status().isAccepted());
        screeningWorker.executeJob(jobId);

        assertThat(statusOf(jobId)).isEqualTo(DONE);
        assertThat(countOf(jobId)).isEqualTo(2);
    }

    @Test
    void retryIsRefusedUnlessTheLastSearchFailed() throws Exception {
        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(offer.creatorId())))
                .andExpect(status().isConflict());

        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        for (int state : new int[] {PENDING, RUNNING, DONE, SUPERSEDED}) {
            setStatus(jobId, state);
            mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId)
                            .with(as(offer.creatorId())))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.detail").isNotEmpty());
            assertThat(statusOf(jobId)).isEqualTo(state);
        }
    }

    @Test
    void retryIsRefusedOnAClosedOffer() throws Exception {
        offerVector();
        screeningJobService.onPublished(offerId);
        setStatus(onlyJob(), FAILED);
        data.setOfferStatus(offerId, EmbeddingTestData.CLOSED, null);

        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(offer.creatorId())))
                .andExpect(status().isConflict());

        assertThat(statusOf(onlyJob())).isEqualTo(FAILED);
    }

    @Test
    void retryRights() throws Exception {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        setStatus(jobId, FAILED);
        UUID plainMember = data.recruiterIn(offer.companyId(), false);
        UUID owner = data.recruiterIn(offer.companyId(), true);
        OfferFixture foreign = data.publishedOffer();

        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(plainMember)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(foreign.creatorId())))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(data.loneRecruiter())))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", UUID.randomUUID())
                        .with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
        assertThat(statusOf(jobId)).isEqualTo(FAILED);

        mockMvc.perform(post("/api/v1/job-offers/{id}/screening/retry", offerId).with(as(owner)))
                .andExpect(status().isAccepted());
        assertThat(statusOf(jobId)).isEqualTo(PENDING);
    }

    // --- reprise au démarrage ----------------------------------------------------------------------

    @Test
    void bootRecoveryResubmitsDueJobsRetriesStaleRunningOnesAndLeavesFailedAndDoneAlone() {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID pending = onlyJob();
        UUID stale = jobWithStatus(RUNNING);
        jdbc.update("UPDATE screening_job SET started_at = now() - interval '20 minutes' WHERE job_id = ?", stale);
        UUID failed = jobWithStatus(FAILED);
        UUID done = jobWithStatus(DONE);
        clearInvocations(screeningExecutor);

        screeningWorker.recoverOrphanJobs();

        assertThat(statusOf(pending)).isEqualTo(PENDING);
        assertThat(statusOf(stale)).isEqualTo(PENDING);
        assertThat(attemptsOf(stale)).isEqualTo(1);
        assertThat(statusOf(failed)).isEqualTo(FAILED);
        assertThat(statusOf(done)).isEqualTo(DONE);
        // Le PENDING dû est resoumis ; le périmé est replanifié (non échu) et les terminés ne sont jamais touchés.
        verify(screeningExecutor, atLeastOnce()).execute(any(Runnable.class));
    }

    /** Job d'une nouvelle offre publiée, forcé à l'état demandé (sans vecteur : aucune exécution possible). */
    private UUID jobWithStatus(int status) {
        OfferFixture other = data.publishedOffer();
        data.offerFiche(other.offerId(), 1, OFFER_CONTENT);
        screeningJobService.onPublished(other.offerId());
        UUID jobId = jdbc.queryForObject("SELECT job_id FROM screening_job WHERE job_offer_id = ?", UUID.class,
                other.offerId());
        setStatus(jobId, status);
        return jobId;
    }

    // --- signaux de l'offre ---------------------------------------------------------------------

    @Test
    void theDetailAndTheListCarryTheScreeningSignalThroughItsWholeLife() throws Exception {
        // Aucune recherche : le champ est présent mais nul.
        mockMvc.perform(get("/api/v1/job-offers/{id}", offerId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.screening").value((Object) null));
        mockMvc.perform(get("/api/v1/job-offers").with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].screening").value((Object) null));

        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        assertSignal(offer.creatorId(), "pending", null);

        setStatus(jobId, RUNNING);
        assertSignal(offer.creatorId(), "running", null);

        candidates(3);
        setStatus(jobId, PENDING);
        screeningWorker.executeJob(jobId);
        assertSignal(offer.creatorId(), "done", 3);

        setStatus(jobId, FAILED);
        assertSignal(offer.creatorId(), "failed", null);

        // Un job supersédé n'est jamais affiché.
        setStatus(jobId, SUPERSEDED);
        mockMvc.perform(get("/api/v1/job-offers/{id}", offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.screening").value((Object) null));
    }

    @Test
    void aDoneSearchWithNoCandidateIsShownAsDoneWithZero() throws Exception {
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();
        screeningWorker.executeJob(jobId);

        assertSignal(offer.creatorId(), "done", 0);
    }

    @Test
    void theLatestVisibleJobWinsWhenAnOlderOneWasSuperseded() throws Exception {
        screeningJobService.onPublished(offerId);
        UUID first = onlyJob();
        UUID newFiche = data.offerFiche(offerId, 2, OFFER_CONTENT);
        data.embedding(newFiche, 1f, 0f);
        screeningJobService.onOfferEmbeddingDone(newFiche);

        assertThat(statusOf(first)).isEqualTo(SUPERSEDED);
        assertSignal(offer.creatorId(), "pending", null);
    }

    private void assertSignal(UUID recruiterId, String status, Integer count) throws Exception {
        var detail = mockMvc.perform(get("/api/v1/job-offers/{id}", offerId).with(as(recruiterId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.screening.status").value(status));
        var list = mockMvc.perform(get("/api/v1/job-offers").with(as(recruiterId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '" + offerId + "')].screening.status").value(status));
        if (count == null) {
            detail.andExpect(jsonPath("$.screening.candidateCount").value((Object) null));
            list.andExpect(jsonPath("$.items[?(@.id == '" + offerId + "')].screening.candidateCount")
                    .value((Object) null));
        } else {
            detail.andExpect(jsonPath("$.screening.candidateCount").value(count));
            list.andExpect(jsonPath("$.items[?(@.id == '" + offerId + "')].screening.candidateCount").value(count));
        }
    }

    // --- flux SSE ---------------------------------------------------------------------------------

    private static final String EVENTS = "/api/v1/job-offers/{id}/screening/events";

    @Test
    void theStreamRefusesWithoutTokenAndHidesOffersOutsideTheCompany() throws Exception {
        mockMvc.perform(get(EVENTS, offerId).accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(request().asyncNotStarted());

        OfferFixture foreign = data.publishedOffer();
        mockMvc.perform(get(EVENTS, offerId).with(as(foreign.creatorId()))
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(EVENTS, UUID.randomUUID()).with(as(offer.creatorId()))
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void anyCompanyMemberCanFollowTheStreamAndAnOfferWithoutSearchSendsNoneThenCloses() throws Exception {
        UUID plainMember = data.recruiterIn(offer.companyId(), false);

        MvcResult stream = open(plainMember);
        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());

        assertThat(stream.getResponse().getContentType()).startsWith(MediaType.TEXT_EVENT_STREAM_VALUE);
        assertThat(stream.getResponse().getContentAsString()).contains("event:status", "\"status\":\"none\"");
    }

    @Test
    void aFinishedSearchIsSentWithItsCountThenTheStreamCloses() throws Exception {
        candidates(2);
        publishAndRun();

        MvcResult stream = open(offer.creatorId());
        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());

        assertThat(stream.getResponse().getContentAsString())
                .contains("\"status\":\"done\"", "\"candidateCount\":2");
    }

    @Test
    void aFailedSearchIsSentThenTheStreamCloses() throws Exception {
        offerVector();
        screeningJobService.onPublished(offerId);
        setStatus(onlyJob(), FAILED);

        MvcResult stream = open(offer.creatorId());
        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());

        assertThat(stream.getResponse().getContentAsString()).contains("\"status\":\"failed\"");
    }

    @Test
    void anOpenStreamFollowsThePendingSearchUntilItIsDone() throws Exception {
        candidates(2);
        offerVector();
        screeningJobService.onPublished(offerId);
        UUID jobId = onlyJob();

        MvcResult stream = open(offer.creatorId());
        assertThat(stream.getResponse().getContentAsString()).contains("\"status\":\"pending\"");
        assertThat(stream.getRequest().isAsyncStarted()).isTrue();

        screeningWorker.executeJob(jobId);

        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());
        String content = stream.getResponse().getContentAsString();
        assertThat(content).contains("\"status\":\"running\"", "\"status\":\"done\"", "\"candidateCount\":2");
    }

    private MvcResult open(UUID recruiterId) throws Exception {
        return mockMvc.perform(get(EVENTS, offerId).with(as(recruiterId))
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(request().asyncStarted())
                .andReturn();
    }
}
