package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;

/**
 * Tableau de bord candidat ({@code GET /api/v1/candidates/me/dashboard}) sur
 * PostgreSQL réel : compteurs par statut (chaque statut, absent = 0), les 4
 * dernières candidatures (ordre, résumé d'offre), invitations ouvertes
 * (égalité avec {@code GET /candidates/me/invitations}), offres ouvertes
 * (égalité avec le {@code total} de {@code GET /jobs}), isolement entre
 * candidats, comptes sans profil, 401 et nombre de requêtes constant. Base
 * partagée : les compteurs globaux (offres ouvertes) se vérifient par écart.
 */
class CandidateDashboardIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String DASHBOARD = "/api/v1/candidates/me/dashboard";
    private static final String INVITATIONS = "/api/v1/candidates/me/invitations";
    private static final String BOARD = "/api/v1/jobs";
    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";
    private static final String CANDIDATE_CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Engineer\"}";

    private static final int DRAFT = 1;
    private static final int SUBMITTED = 2;
    private static final int WITHDRAWN = 3;
    private static final int ACCEPTED = 4;
    private static final int REJECTED = 5;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private EmbeddingTestData data;
    private UUID candidateId;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        candidateId = data.candidate(null);
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    // --- aides -----------------------------------------------------------------------

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    private JsonNode dashboard(UUID userId) throws Exception {
        String body = mockMvc.perform(get(DASHBOARD).with(as(userId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    /** Candidature du candidat à une nouvelle offre publiée ; {@code minutesAgo} fixe l'ordre de création. */
    private OfferFixture apply(UUID forCandidate, int applicationStatus, int minutesAgo) {
        OfferFixture offer = data.publishedOffer();
        data.application(forCandidate, offer.offerId(), applicationStatus);
        jdbc.update("""
                UPDATE application SET created_at = now() - make_interval(mins => ?)
                WHERE candidate_id = ? AND job_offer_id = ?""", minutesAgo, forCandidate, offer.offerId());
        return offer;
    }

    private long openOffersOnTheBoard() throws Exception {
        String body = mockMvc.perform(get(BOARD)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("total").asLong();
    }

    /** Invitation (INVITED) du candidat à une offre ; la fiche du candidat est créée une fois. */
    private void invite(UUID forCandidate, OfferFixture offer) {
        UUID candidateFiche = jdbc.query(
                "SELECT candidate_normalized_profile_id FROM offer_candidate WHERE candidate_id = ? LIMIT 1",
                resultSet -> resultSet.next() ? (UUID) resultSet.getObject(1) : null, forCandidate);
        if (candidateFiche == null) {
            candidateFiche = data.candidateFiche(forCandidate, 1, CANDIDATE_CONTENT);
        }
        UUID offerFiche = data.offerFiche(offer.offerId(), 1, OFFER_CONTENT);
        UUID screeningJobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at)
                VALUES (?, ?, ?, 3, 1, now(), 1, now(), now())""", screeningJobId, offer.offerId(), offerFiche);
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, invited_by_user_id,
                                             invited_at, created_at)
                VALUES (?, ?, ?, ?, ?, 1, 0.1, 2, ?, now(), now())""",
                UUID.randomUUID(), offer.offerId(), forCandidate, candidateFiche, screeningJobId, offer.creatorId());
    }

    // --- nominal et vide -----------------------------------------------------------------------

    @Test
    void aCandidateWithoutAnyApplicationGetsZerosAndAnEmptyList() throws Exception {
        mockMvc.perform(get(DASHBOARD).with(as(candidateId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applications.draft").value(0))
                .andExpect(jsonPath("$.applications.submitted").value(0))
                .andExpect(jsonPath("$.applications.withdrawn").value(0))
                .andExpect(jsonPath("$.applications.accepted").value(0))
                .andExpect(jsonPath("$.applications.rejected").value(0))
                .andExpect(jsonPath("$.recentApplications").isArray())
                .andExpect(jsonPath("$.recentApplications").isEmpty())
                .andExpect(jsonPath("$.openInvitations").value(0))
                .andExpect(jsonPath("$.openOffers").isNumber());
    }

    @Test
    void anAccountWithoutCandidateProfileIsNotAnError() throws Exception {
        UUID recruiterOnly = data.loneRecruiter();

        JsonNode body = dashboard(recruiterOnly);

        assertThat(body.get("applications").get("submitted").asLong()).isZero();
        assertThat(body.get("recentApplications")).isEmpty();
        assertThat(body.get("openInvitations").asLong()).isZero();
    }

    @Test
    void theDashboardRequiresAToken() throws Exception {
        mockMvc.perform(get(DASHBOARD)).andExpect(status().isUnauthorized());
    }

    // --- candidatures par statut --------------------------------------------------------------------

    @Test
    void everyStatusIsCountedOnItsOwnAndOtherCandidatesAreIgnored() throws Exception {
        apply(candidateId, DRAFT, 1);
        apply(candidateId, SUBMITTED, 2);
        apply(candidateId, SUBMITTED, 3);
        apply(candidateId, WITHDRAWN, 4);
        apply(candidateId, ACCEPTED, 5);
        apply(candidateId, REJECTED, 6);
        apply(candidateId, REJECTED, 7);
        apply(candidateId, REJECTED, 8);
        UUID other = data.candidate(null);
        apply(other, SUBMITTED, 1);
        apply(other, ACCEPTED, 2);

        JsonNode counts = dashboard(candidateId).get("applications");

        assertThat(counts.get("draft").asLong()).isEqualTo(1);
        assertThat(counts.get("submitted").asLong()).isEqualTo(2);
        assertThat(counts.get("withdrawn").asLong()).isEqualTo(1);
        assertThat(counts.get("accepted").asLong()).isEqualTo(1);
        assertThat(counts.get("rejected").asLong()).isEqualTo(3);
    }

    @Test
    void aStatusWithoutApplicationStaysAtZeroWhileTheOthersAreCounted() throws Exception {
        apply(candidateId, ACCEPTED, 1);

        mockMvc.perform(get(DASHBOARD).with(as(candidateId)))
                .andExpect(jsonPath("$.applications.accepted").value(1))
                .andExpect(jsonPath("$.applications.draft").value(0))
                .andExpect(jsonPath("$.applications.submitted").value(0))
                .andExpect(jsonPath("$.applications.withdrawn").value(0))
                .andExpect(jsonPath("$.applications.rejected").value(0));
    }

    // --- dernières candidatures -------------------------------------------------------------------

    @Test
    void onlyTheFourNewestApplicationsAreListedNewestFirstWhileTheCountsCoverAll() throws Exception {
        OfferFixture oldest = apply(candidateId, SUBMITTED, 60);
        apply(candidateId, REJECTED, 50);
        OfferFixture third = apply(candidateId, ACCEPTED, 30);
        OfferFixture second = apply(candidateId, DRAFT, 20);
        OfferFixture newest = apply(candidateId, SUBMITTED, 10);
        OfferFixture fourth = apply(candidateId, WITHDRAWN, 40);

        JsonNode body = dashboard(candidateId);

        JsonNode recent = body.get("recentApplications");
        assertThat(recent).hasSize(4);
        assertThat(recent.get(0).get("job").get("publicId").asText()).isEqualTo(publicIdOf(newest));
        assertThat(recent.get(1).get("job").get("publicId").asText()).isEqualTo(publicIdOf(second));
        assertThat(recent.get(2).get("job").get("publicId").asText()).isEqualTo(publicIdOf(third));
        assertThat(recent.get(3).get("job").get("publicId").asText()).isEqualTo(publicIdOf(fourth));
        assertThat(recent.findValuesAsString("publicId")).doesNotContain(publicIdOf(oldest));
        assertThat(body.get("applications").get("submitted").asLong()).isEqualTo(2);
        assertThat(body.get("applications").get("rejected").asLong()).isEqualTo(1);
    }

    @Test
    void aRecentApplicationCarriesItsStatusDatesAndOfferSummaryAndNothingElse() throws Exception {
        OfferFixture offer = apply(candidateId, ACCEPTED, 5);

        String body = mockMvc.perform(get(DASHBOARD).with(as(candidateId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recentApplications.length()").value(1))
                .andExpect(jsonPath("$.recentApplications[0].id").isNotEmpty())
                .andExpect(jsonPath("$.recentApplications[0].status").value("accepted"))
                .andExpect(jsonPath("$.recentApplications[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.recentApplications[0].updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.recentApplications[0].job.publicId").value(publicIdOf(offer)))
                .andExpect(jsonPath("$.recentApplications[0].job.slug").value("embedding-it-offer"))
                .andExpect(jsonPath("$.recentApplications[0].job.title").value("Embedding IT offer"))
                .andExpect(jsonPath("$.recentApplications[0].job.companyName")
                        .value("Embedding IT " + offer.companyId()))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("answers", "cv", "candidateId", candidateId.toString());
    }

    @Test
    void aRecentApplicationOnAClosedOrExpiredOfferIsStillListed() throws Exception {
        OfferFixture closed = apply(candidateId, SUBMITTED, 2);
        data.setOfferStatus(closed.offerId(), EmbeddingTestData.CLOSED, null);
        OfferFixture expired = apply(candidateId, SUBMITTED, 1);
        data.setOfferStatus(expired.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));

        mockMvc.perform(get(DASHBOARD).with(as(candidateId)))
                .andExpect(jsonPath("$.recentApplications.length()").value(2))
                .andExpect(jsonPath("$.applications.submitted").value(2));
    }

    // --- invitations ouvertes -------------------------------------------------------------------------

    @Test
    void openInvitationsFollowTheSameRulesAsTheInvitationList() throws Exception {
        invite(candidateId, data.publishedOffer());
        invite(candidateId, data.publishedOffer());
        OfferFixture closed = data.publishedOffer();
        invite(candidateId, closed);
        data.setOfferStatus(closed.offerId(), EmbeddingTestData.CLOSED, null);
        OfferFixture expired = data.publishedOffer();
        invite(candidateId, expired);
        data.setOfferStatus(expired.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        OfferFixture draftOffer = data.publishedOffer();
        invite(candidateId, draftOffer);
        data.setOfferStatus(draftOffer.offerId(), EmbeddingTestData.DRAFT, null);
        OfferFixture applied = data.publishedOffer();
        invite(candidateId, applied);
        data.application(candidateId, applied.offerId(), DRAFT);
        OfferFixture lastDay = data.publishedOffer();
        invite(candidateId, lastDay);
        data.setOfferStatus(lastDay.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now());
        UUID someoneElse = data.candidate(null);
        invite(someoneElse, data.publishedOffer());

        long listed = objectMapper.readTree(mockMvc.perform(get(INVITATIONS).with(as(candidateId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).size();

        assertThat(listed).isEqualTo(3);
        assertThat(dashboard(candidateId).get("openInvitations").asLong()).isEqualTo(listed);
    }

    @Test
    void aSuggestionThatWasNotSentIsNotAnInvitation() throws Exception {
        OfferFixture offer = data.publishedOffer();
        invite(candidateId, offer);
        jdbc.update("""
                UPDATE offer_candidate SET status = 1, invited_by_user_id = NULL, invited_at = NULL
                WHERE job_offer_id = ? AND candidate_id = ?""", offer.offerId(), candidateId);

        assertThat(dashboard(candidateId).get("openInvitations").asLong()).isZero();
    }

    // --- offres ouvertes ------------------------------------------------------------------------------

    @Test
    void openOffersAreTheBoardTotalAndOnlyOpenOnesMoveIt() throws Exception {
        long before = openOffersOnTheBoard();
        assertThat(dashboard(candidateId).get("openOffers").asLong()).isEqualTo(before);

        data.publishedOffer();
        OfferFixture lastDay = data.publishedOffer();
        data.setOfferStatus(lastDay.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now());
        OfferFixture expired = data.publishedOffer();
        data.setOfferStatus(expired.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        OfferFixture closed = data.publishedOffer();
        data.setOfferStatus(closed.offerId(), EmbeddingTestData.CLOSED, null);
        data.offer(EmbeddingTestData.DRAFT, null);

        long after = openOffersOnTheBoard();
        assertThat(after).isEqualTo(before + 2);
        assertThat(dashboard(candidateId).get("openOffers").asLong()).isEqualTo(after);
    }

    // --- coût ---------------------------------------------------------------------------------------------

    @Test
    void theNumberOfQueriesDoesNotGrowWithTheNumberOfApplications() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            apply(candidateId, SUBMITTED, 1);
            apply(candidateId, DRAFT, 2);
            dashboard(candidateId); // échauffement : métadonnées hors mesure
            long withTwo = queriesForOneRead(statistics);

            for (int i = 0; i < 10; i++) {
                apply(candidateId, SUBMITTED, 10 + i);
            }
            long withTwelve = queriesForOneRead(statistics);

            assertThat(withTwo).isPositive();
            assertThat(withTwelve).isEqualTo(withTwo);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private long queriesForOneRead(Statistics statistics) throws Exception {
        statistics.clear();
        dashboard(candidateId);
        return statistics.getPrepareStatementCount();
    }

    private String publicIdOf(OfferFixture offer) {
        return jdbc.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, offer.offerId());
    }
}
