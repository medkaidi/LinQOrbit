package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
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
 * Tableau de bord recruteur ({@code GET /api/v1/recruiters/me/dashboard}) sur PostgreSQL réel :
 * offres par statut (chaque statut, absent = 0), offres ouvertes, échéances proches (bornes), candidatures
 * à examiner / décidées (brouillons et retraits exclus), candidats à inviter / invités (consentement,
 * candidature), recherches en échec (dernier job visible), offres à regarder (ordre, limite, champs),
 * isolement entre sociétés, recruteur sans société, 401/404 et nombre de requêtes constant. Chaque
 * compteur est épinglé contre la liste dont il est le total. Base partagée : seules les données du
 * recruteur du test comptent (le périmètre est celui de ses sociétés).
 */
class RecruiterDashboardIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String DASHBOARD = "/api/v1/recruiters/me/dashboard";
    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";
    private static final String CANDIDATE_CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Engineer\"}";

    private static final int DRAFT = 1;
    private static final int VALIDATED = 2;
    private static final int PUBLISHED = 3;
    private static final int CLOSED = 4;

    private static final int APP_DRAFT = 1;
    private static final int APP_SUBMITTED = 2;
    private static final int APP_WITHDRAWN = 3;
    private static final int APP_ACCEPTED = 4;
    private static final int APP_REJECTED = 5;

    private static final int JOB_PENDING = 1;
    private static final int JOB_DONE = 3;
    private static final int JOB_FAILED = 4;
    private static final int JOB_SUPERSEDED = 5;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private EmbeddingTestData data;
    private OfferFixture company;
    private UUID recruiterId;
    private final Map<UUID, UUID> doneJobByOffer = new HashMap<>();
    private final Map<UUID, UUID> candidateFicheByCandidate = new HashMap<>();
    private int nextVersion;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        // Une société avec son recruteur, sans aucune offre : chaque test crée ce dont il a besoin.
        company = data.offer(DRAFT, null);
        jdbc.update("DELETE FROM job_offer WHERE id = ?", company.offerId());
        recruiterId = company.creatorId();
        nextVersion = 1;
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    // --- aides -----------------------------------------------------------------------

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    private JsonNode dashboard() throws Exception {
        return dashboard(recruiterId);
    }

    private JsonNode dashboard(UUID userId) throws Exception {
        String body = mockMvc.perform(get(DASHBOARD).with(as(userId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private OfferFixture offer(int status, LocalDate expiresAt) {
        return data.offerIn(company, status, expiresAt, "Offer " + status);
    }

    private OfferFixture offer(int status, LocalDate expiresAt, String title) {
        return data.offerIn(company, status, expiresAt, title);
    }

    private void applications(OfferFixture offer, int applicationStatus, int count) {
        for (int i = 0; i < count; i++) {
            data.application(data.candidate(null), offer.offerId(), applicationStatus);
        }
    }

    private long listTotal(UUID userId, String query) throws Exception {
        String body = mockMvc.perform(get("/api/v1/job-offers?" + query).with(as(userId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("total").asLong();
    }

    private long applicationsTotal(OfferFixture offer, String applicationStatus) throws Exception {
        String body = mockMvc.perform(get("/api/v1/job-offers/{id}/applications", offer.offerId())
                        .param("status", applicationStatus).with(as(recruiterId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("total").asLong();
    }

    /** Job de recherche d'une offre ; {@code minutesAgo} fixe l'ordre de création. Retourne l'id du job. */
    private UUID screeningJob(OfferFixture offer, int jobStatus, int minutesAgo) {
        UUID fiche = data.offerFiche(offer.offerId(), nextVersion++, OFFER_CONTENT);
        UUID jobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at, error)
                VALUES (?, ?, ?, ?, ?, now(), ?, now() - make_interval(mins => ?),
                        CASE WHEN ? IN (3, 4, 5) THEN now() END, CASE WHEN ? = 4 THEN 'boom' END)""",
                jobId, offer.offerId(), fiche, jobStatus, jobStatus == JOB_FAILED ? 3 : 1,
                jobStatus == JOB_DONE ? 0 : null, minutesAgo, jobStatus, jobStatus);
        return jobId;
    }

    /** Suggestion (SUGGESTED = 1, INVITED = 2) d'un candidat sur l'offre, rattachée à un job terminé de l'offre. */
    private UUID suggest(OfferFixture offer, UUID candidateId, int suggestionStatus) {
        UUID jobId = doneJobByOffer.computeIfAbsent(offer.offerId(), id -> screeningJob(offer, JOB_DONE, 5));
        UUID fiche = candidateFicheByCandidate.computeIfAbsent(candidateId,
                id -> data.candidateFiche(id, 1, CANDIDATE_CONTENT));
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, invited_by_user_id,
                                             invited_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0.1, ?, ?, CASE WHEN ? = 2 THEN now() END, now())""",
                id, offer.offerId(), candidateId, fiche, jobId, nextRank(offer), suggestionStatus,
                suggestionStatus == 2 ? offer.creatorId() : null, suggestionStatus);
        return id;
    }

    private int nextRank(OfferFixture offer) {
        Integer max = jdbc.queryForObject(
                "SELECT COALESCE(MAX(rank), 0) FROM offer_candidate WHERE job_offer_id = ?", Integer.class,
                offer.offerId());
        return max + 1;
    }

    private JsonNode suggestions(OfferFixture offer) throws Exception {
        String body = mockMvc.perform(get("/api/v1/job-offers/{id}/suggested-candidates", offer.offerId())
                        .with(as(recruiterId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("items");
    }

    private static long cardsWithStatus(JsonNode cards, String cardStatus) {
        long count = 0;
        for (JsonNode card : cards) {
            if (cardStatus.equals(card.get("status").asText())) {
                count++;
            }
        }
        return count;
    }

    // --- vide, droits ------------------------------------------------------------------------

    @Test
    void aRecruiterWithACompanyButNoOfferGetsZerosAndAnEmptyList() throws Exception {
        mockMvc.perform(get(DASHBOARD).with(as(recruiterId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offers.draft").value(0))
                .andExpect(jsonPath("$.offers.validated").value(0))
                .andExpect(jsonPath("$.offers.published").value(0))
                .andExpect(jsonPath("$.offers.closed").value(0))
                .andExpect(jsonPath("$.liveOffers").value(0))
                .andExpect(jsonPath("$.closingSoon.count").value(0))
                .andExpect(jsonPath("$.closingSoon.nextExpiry").isEmpty())
                .andExpect(jsonPath("$.applications.toReview").value(0))
                .andExpect(jsonPath("$.applications.accepted").value(0))
                .andExpect(jsonPath("$.applications.rejected").value(0))
                .andExpect(jsonPath("$.candidates.toInvite").value(0))
                .andExpect(jsonPath("$.candidates.invited").value(0))
                .andExpect(jsonPath("$.candidates.searchesFailed").value(0))
                .andExpect(jsonPath("$.attention").isArray())
                .andExpect(jsonPath("$.attention").isEmpty());
    }

    @Test
    void aRecruiterWithoutCompanyGetsZerosWithoutAnyOtherQuery() throws Exception {
        UUID lone = data.loneRecruiter();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            dashboard(lone); // échauffement
            statistics.clear();
            JsonNode body = dashboard(lone);

            assertThat(body.get("offers").get("published").asLong()).isZero();
            assertThat(body.get("liveOffers").asLong()).isZero();
            assertThat(body.get("applications").get("toReview").asLong()).isZero();
            assertThat(body.get("candidates").get("toInvite").asLong()).isZero();
            assertThat(body.get("attention")).isEmpty();
            // Existence du profil et appartenances : rien d'autre.
            assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    @Test
    void anAccountWithoutRecruiterProfileGetsA404() throws Exception {
        mockMvc.perform(get(DASHBOARD).with(as(data.bareUser()))).andExpect(status().isNotFound());
        mockMvc.perform(get(DASHBOARD).with(as(data.candidate(null)))).andExpect(status().isNotFound());
    }

    @Test
    void theDashboardRequiresAToken() throws Exception {
        mockMvc.perform(get(DASHBOARD)).andExpect(status().isUnauthorized());
    }

    // --- offres par statut ----------------------------------------------------------------------------

    @Test
    void everyOfferStatusIsCountedOnItsOwnAndEqualsTheListTotals() throws Exception {
        offer(DRAFT, null);
        offer(VALIDATED, null);
        offer(VALIDATED, null);
        offer(PUBLISHED, null);
        offer(PUBLISHED, LocalDate.now().minusDays(3)); // publiée mais expirée : reste « published »
        offer(PUBLISHED, LocalDate.now().plusDays(90));
        offer(CLOSED, null);
        offer(CLOSED, null);
        offer(CLOSED, null);
        offer(CLOSED, null);

        JsonNode offers = dashboard().get("offers");

        assertThat(offers.get("draft").asLong()).isEqualTo(1);
        assertThat(offers.get("validated").asLong()).isEqualTo(2);
        assertThat(offers.get("published").asLong()).isEqualTo(3);
        assertThat(offers.get("closed").asLong()).isEqualTo(4);
        assertThat(offers.get("draft").asLong()).isEqualTo(listTotal(recruiterId, "status=draft"));
        assertThat(offers.get("validated").asLong()).isEqualTo(listTotal(recruiterId, "status=validated"));
        assertThat(offers.get("published").asLong()).isEqualTo(listTotal(recruiterId, "status=published"));
        assertThat(offers.get("closed").asLong()).isEqualTo(listTotal(recruiterId, "status=closed"));
    }

    @Test
    void aStatusWithoutOfferStaysAtZeroWhileTheOthersAreCounted() throws Exception {
        offer(CLOSED, null);

        mockMvc.perform(get(DASHBOARD).with(as(recruiterId)))
                .andExpect(jsonPath("$.offers.closed").value(1))
                .andExpect(jsonPath("$.offers.draft").value(0))
                .andExpect(jsonPath("$.offers.validated").value(0))
                .andExpect(jsonPath("$.offers.published").value(0));
    }

    @Test
    void anotherCompanysOffersAreIgnoredAndEveryCompanyOfTheRecruiterIsSummed() throws Exception {
        offer(PUBLISHED, null);
        data.publishedOffer(); // société étrangère, autre recruteur
        OfferFixture second = data.offer(PUBLISHED, null);
        data.join(recruiterId, second.companyId());
        applications(second, APP_SUBMITTED, 2);

        JsonNode body = dashboard();

        assertThat(body.get("offers").get("published").asLong()).isEqualTo(2);
        assertThat(body.get("liveOffers").asLong()).isEqualTo(2);
        assertThat(body.get("applications").get("toReview").asLong()).isEqualTo(2);
        // Le recruteur d'une société étrangère ne voit pas les offres de l'autre.
        JsonNode foreign = dashboard(second.creatorId());
        assertThat(foreign.get("offers").get("published").asLong()).isEqualTo(1);
        assertThat(foreign.get("applications").get("toReview").asLong()).isEqualTo(2);
    }

    // --- offres ouvertes ----------------------------------------------------------------------------------

    @Test
    void liveOffersArePublishedAndNotExpiredAndEqualPublishedMinusExpiredOfTheList() throws Exception {
        offer(PUBLISHED, null);
        offer(PUBLISHED, LocalDate.now()); // dernier jour : encore ouverte
        offer(PUBLISHED, LocalDate.now().plusDays(45));
        offer(PUBLISHED, LocalDate.now().minusDays(1)); // expirée
        offer(PUBLISHED, LocalDate.now().minusDays(40)); // expirée
        offer(CLOSED, null);
        offer(DRAFT, null);
        offer(VALIDATED, LocalDate.now().plusDays(5));

        long live = dashboard().get("liveOffers").asLong();

        assertThat(live).isEqualTo(3);
        assertThat(live).isEqualTo(listTotal(recruiterId, "status=published")
                - listTotal(recruiterId, "status=published&expiry=expired"));
    }

    // --- échéances proches ----------------------------------------------------------------------------------

    @Test
    void closingSoonCoversTodayThroughThirtyDaysIncludedAndReportsTheNearestExpiry() throws Exception {
        LocalDate today = LocalDate.now();
        offer(PUBLISHED, today.plusDays(30)); // borne haute incluse
        offer(PUBLISHED, today.plusDays(12));
        offer(PUBLISHED, today); // aujourd'hui inclus
        offer(PUBLISHED, today.plusDays(31)); // hors fenêtre
        offer(PUBLISHED, today.minusDays(1)); // déjà expirée
        offer(PUBLISHED, null); // sans échéance
        offer(CLOSED, today.plusDays(5)); // pas publiée
        offer(DRAFT, today.plusDays(5));

        JsonNode closing = dashboard().get("closingSoon");

        assertThat(closing.get("count").asLong()).isEqualTo(3);
        assertThat(closing.get("nextExpiry").asText()).isEqualTo(today.toString());
        assertThat(closing.get("count").asLong()).isEqualTo(listTotal(recruiterId, "status=published&expiry=expiringSoon"));
    }

    @Test
    void closingSoonWithoutAnyOfferInTheWindowHasNoNextExpiry() throws Exception {
        offer(PUBLISHED, LocalDate.now().plusDays(60));
        offer(PUBLISHED, null);

        mockMvc.perform(get(DASHBOARD).with(as(recruiterId)))
                .andExpect(jsonPath("$.closingSoon.count").value(0))
                .andExpect(jsonPath("$.closingSoon.nextExpiry").isEmpty());
    }

    // --- candidatures --------------------------------------------------------------------------------------------

    @Test
    void submittedAcceptedAndRejectedAreCountedAndDraftsAndWithdrawalsAreNot() throws Exception {
        OfferFixture first = offer(PUBLISHED, null);
        OfferFixture second = offer(CLOSED, null);
        applications(first, APP_SUBMITTED, 2);
        applications(second, APP_SUBMITTED, 1);
        applications(first, APP_ACCEPTED, 1);
        applications(second, APP_REJECTED, 3);
        applications(first, APP_DRAFT, 4);
        applications(second, APP_WITHDRAWN, 2);

        JsonNode counts = dashboard().get("applications");

        assertThat(counts.get("toReview").asLong()).isEqualTo(3);
        assertThat(counts.get("accepted").asLong()).isEqualTo(1);
        assertThat(counts.get("rejected").asLong()).isEqualTo(3);
        assertThat(counts.get("toReview").asLong())
                .isEqualTo(applicationsTotal(first, "submitted") + applicationsTotal(second, "submitted"));
        assertThat(counts.get("accepted").asLong())
                .isEqualTo(applicationsTotal(first, "accepted") + applicationsTotal(second, "accepted"));
        assertThat(counts.get("rejected").asLong())
                .isEqualTo(applicationsTotal(first, "rejected") + applicationsTotal(second, "rejected"));
    }

    @Test
    void aStatusWithoutApplicationStaysAtZero() throws Exception {
        applications(offer(PUBLISHED, null), APP_ACCEPTED, 1);

        mockMvc.perform(get(DASHBOARD).with(as(recruiterId)))
                .andExpect(jsonPath("$.applications.accepted").value(1))
                .andExpect(jsonPath("$.applications.toReview").value(0))
                .andExpect(jsonPath("$.applications.rejected").value(0));
    }

    // --- candidats à inviter / invités ----------------------------------------------------------------------------------

    @Test
    void toInviteAndInvitedCountOnlyConsentingCandidatesOnOpenOffersAndMatchTheSuggestionLists() throws Exception {
        OfferFixture open = offer(PUBLISHED, null);
        OfferFixture lastDay = offer(PUBLISHED, LocalDate.now());
        suggest(open, data.candidate(null), 1);
        suggest(open, data.candidate(null), 1);
        suggest(open, data.candidate(null), 2);
        suggest(lastDay, data.candidate(null), 1);
        // Exclus : consentement absent ou retiré.
        suggest(open, data.candidateWithoutConsent(null), 1);
        UUID withdrawn = data.candidate(null);
        suggest(open, withdrawn, 1);
        data.setConsent(withdrawn, false);
        suggest(open, data.candidateWithoutConsent(null), 2);
        // Exclus : offres non ouvertes.
        OfferFixture expired = offer(PUBLISHED, null);
        suggest(expired, data.candidate(null), 1);
        suggest(expired, data.candidate(null), 2);
        data.setOfferStatus(expired.offerId(), PUBLISHED, LocalDate.now().minusDays(1));
        OfferFixture closed = offer(PUBLISHED, null);
        suggest(closed, data.candidate(null), 1);
        data.setOfferStatus(closed.offerId(), CLOSED, null);
        // Autre société : jamais comptée.
        OfferFixture foreign = data.publishedOffer();
        suggest(foreign, data.candidate(null), 1);

        JsonNode candidates = dashboard().get("candidates");

        assertThat(candidates.get("toInvite").asLong()).isEqualTo(3);
        assertThat(candidates.get("invited").asLong()).isEqualTo(1);
        JsonNode openCards = suggestions(open);
        JsonNode lastDayCards = suggestions(lastDay);
        assertThat(candidates.get("toInvite").asLong())
                .isEqualTo(cardsWithStatus(openCards, "suggested") + cardsWithStatus(lastDayCards, "suggested"));
        assertThat(candidates.get("invited").asLong())
                .isEqualTo(cardsWithStatus(openCards, "invited") + cardsWithStatus(lastDayCards, "invited"));
    }

    @Test
    void aSuggestedCandidateWhoAppliedIsNotToInviteButAnInvitedOneStaysInvited() throws Exception {
        OfferFixture open = offer(PUBLISHED, null);
        UUID appliedSuggested = data.candidate(null);
        suggest(open, appliedSuggested, 1);
        data.application(appliedSuggested, open.offerId(), APP_SUBMITTED);
        UUID appliedInvited = data.candidate(null);
        suggest(open, appliedInvited, 2);
        data.application(appliedInvited, open.offerId(), APP_DRAFT);
        suggest(open, data.candidate(null), 1);

        JsonNode candidates = dashboard().get("candidates");

        assertThat(candidates.get("toInvite").asLong()).isEqualTo(1);
        assertThat(candidates.get("invited").asLong()).isEqualTo(1);
        assertThat(cardsWithStatus(suggestions(open), "suggested")).isEqualTo(1);
    }

    // --- recherches en échec -----------------------------------------------------------------------------------------------

    @Test
    void searchesFailedCountsOpenOffersWhoseLatestVisibleJobFailedAndMatchesTheListSignals() throws Exception {
        OfferFixture failed = offer(PUBLISHED, null);
        screeningJob(failed, JOB_FAILED, 1);
        OfferFixture failedAfterDone = offer(PUBLISHED, null);
        screeningJob(failedAfterDone, JOB_DONE, 30);
        screeningJob(failedAfterDone, JOB_FAILED, 1);
        // Dernier job visible = FAILED : un job supersédé plus récent n'existe plus côté produit.
        OfferFixture failedThenSuperseded = offer(PUBLISHED, null);
        screeningJob(failedThenSuperseded, JOB_FAILED, 30);
        screeningJob(failedThenSuperseded, JOB_SUPERSEDED, 1);
        // Reprise réussie : le dernier job n'est plus en échec.
        OfferFixture recovered = offer(PUBLISHED, null);
        screeningJob(recovered, JOB_FAILED, 30);
        screeningJob(recovered, JOB_DONE, 1);
        OfferFixture pending = offer(PUBLISHED, null);
        screeningJob(pending, JOB_PENDING, 1);
        // Offres non ouvertes.
        OfferFixture closed = offer(CLOSED, null);
        screeningJob(closed, JOB_FAILED, 1);
        OfferFixture expired = offer(PUBLISHED, LocalDate.now().minusDays(2));
        screeningJob(expired, JOB_FAILED, 1);
        // Autre société.
        screeningJob(data.publishedOffer(), JOB_FAILED, 1);

        long searchesFailed = dashboard().get("candidates").get("searchesFailed").asLong();

        assertThat(searchesFailed).isEqualTo(3);
        String body = mockMvc.perform(get("/api/v1/job-offers?status=published&size=50").with(as(recruiterId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long fromTheList = 0;
        for (JsonNode item : objectMapper.readTree(body).get("items")) {
            JsonNode signal = item.get("screening");
            boolean notExpired = item.get("expiresAt").isNull()
                    || !LocalDate.parse(item.get("expiresAt").asText()).isBefore(LocalDate.now());
            if (notExpired && signal != null && !signal.isNull() && "failed".equals(signal.get("status").asText())) {
                fromTheList++;
            }
        }
        assertThat(searchesFailed).isEqualTo(fromTheList);
    }

    // --- offres à regarder -------------------------------------------------------------------------------------------------------

    @Test
    void attentionListsOffersWithPendingApplicationsFirstThenTheNearestExpiriesAndStopsAtFive() throws Exception {
        LocalDate today = LocalDate.now();
        OfferFixture most = offer(PUBLISHED, today.plusDays(80), "Most pending");
        applications(most, APP_SUBMITTED, 3);
        OfferFixture closedWithPending = offer(CLOSED, null, "Closed with pending");
        applications(closedWithPending, APP_SUBMITTED, 2);
        OfferFixture soonWithOne = offer(PUBLISHED, today.plusDays(4), "Soon with one");
        applications(soonWithOne, APP_SUBMITTED, 1);
        OfferFixture laterWithOne = offer(PUBLISHED, today.plusDays(50), "Later with one");
        applications(laterWithOne, APP_SUBMITTED, 1);
        OfferFixture noExpiryWithOne = offer(PUBLISHED, null, "No expiry with one");
        applications(noExpiryWithOne, APP_SUBMITTED, 1);
        offer(PUBLISHED, today.plusDays(2), "Closing in two days");
        offer(PUBLISHED, today.plusDays(20), "Closing in twenty days");
        // Rien à regarder : brouillon, retraits/décisions seuls, publiée loin de l'échéance.
        OfferFixture quiet = offer(PUBLISHED, today.plusDays(200), "Quiet");
        applications(quiet, APP_ACCEPTED, 2);
        applications(quiet, APP_WITHDRAWN, 1);
        applications(offer(DRAFT, null, "Draft"), APP_DRAFT, 2);

        JsonNode attention = dashboard().get("attention");

        assertThat(attention).hasSize(5);
        assertThat(titles(attention)).containsExactly("Most pending", "Closed with pending", "Soon with one",
                "Later with one", "No expiry with one");
        assertThat(attention.get(0).get("toReview").asLong()).isEqualTo(3);
        assertThat(attention.get(1).get("toReview").asLong()).isEqualTo(2);
        assertThat(attention.get(1).get("status").asText()).isEqualTo("closed");
        assertThat(attention.get(2).get("expiresAt").asText()).isEqualTo(today.plusDays(4).toString());
        assertThat(attention.get(4).get("expiresAt").isNull()).isTrue();
    }

    @Test
    void attentionFallsBackOnClosingSoonOffersWhenNothingIsPending() throws Exception {
        LocalDate today = LocalDate.now();
        offer(PUBLISHED, today.plusDays(20), "Twenty");
        offer(PUBLISHED, today.plusDays(2), "Two");
        offer(PUBLISHED, today.plusDays(31), "Too far");
        offer(PUBLISHED, null, "No expiry");
        offer(PUBLISHED, today.minusDays(1), "Expired");
        offer(VALIDATED, today.plusDays(3), "Not published");

        assertThat(titles(dashboard().get("attention"))).containsExactly("Two", "Twenty");
    }

    @Test
    void anAttentionOfferCarriesItsScreeningSignalAndLeaksNothingAboutCandidates() throws Exception {
        OfferFixture withSearch = offer(PUBLISHED, null, "With search");
        UUID candidateId = data.candidate(null);
        suggest(withSearch, candidateId, 1);
        data.application(candidateId, withSearch.offerId(), APP_SUBMITTED);
        OfferFixture failedSearch = offer(PUBLISHED, null, "Failed search");
        screeningJob(failedSearch, JOB_FAILED, 1);
        applications(failedSearch, APP_SUBMITTED, 1);
        OfferFixture noSearch = offer(PUBLISHED, null, "No search");
        applications(noSearch, APP_SUBMITTED, 1);

        String raw = mockMvc.perform(get(DASHBOARD).with(as(recruiterId)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode attention = objectMapper.readTree(raw).get("attention");

        JsonNode done = byTitle(attention, "With search");
        assertThat(done.get("screening").get("status").asText()).isEqualTo("done");
        assertThat(done.get("screening").get("candidateCount").asLong()).isZero();
        assertThat(byTitle(attention, "Failed search").get("screening").get("status").asText()).isEqualTo("failed");
        assertThat(byTitle(attention, "No search").get("screening").isNull()).isTrue();
        assertThat(done.get("id").asText()).isEqualTo(withSearch.offerId().toString());
        assertThat(raw).doesNotContain(candidateId.toString(), "embedding-it-", "candidateId", "email");
    }

    // --- coût ------------------------------------------------------------------------------------------------------------------------

    @Test
    void theNumberOfQueriesDoesNotGrowWithTheNumberOfOffersApplicationsAndSuggestions() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            populate(2);
            dashboard(); // échauffement : métadonnées hors mesure
            long withFew = queriesForOneRead(statistics);

            populate(10);
            long withMany = queriesForOneRead(statistics);

            assertThat(withFew).isPositive();
            assertThat(withMany).isEqualTo(withFew);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    /** {@code offers} offres ouvertes, chacune avec candidatures, suggestions et un job de recherche. */
    private void populate(int offers) {
        for (int i = 0; i < offers; i++) {
            OfferFixture offer = offer(PUBLISHED, LocalDate.now().plusDays(5 + i), "Populated " + i);
            applications(offer, APP_SUBMITTED, 2);
            suggest(offer, data.candidate(null), 1);
            suggest(offer, data.candidate(null), 2);
        }
    }

    private long queriesForOneRead(Statistics statistics) throws Exception {
        statistics.clear();
        dashboard();
        return statistics.getPrepareStatementCount();
    }

    private static java.util.List<String> titles(JsonNode attention) {
        java.util.List<String> titles = new java.util.ArrayList<>();
        attention.forEach(item -> titles.add(item.get("title").asText()));
        return titles;
    }

    private static JsonNode byTitle(JsonNode attention, String title) {
        for (JsonNode item : attention) {
            if (title.equals(item.get("title").asText())) {
                return item;
            }
        }
        throw new AssertionError("Offre absente de la liste : " + title);
    }
}
