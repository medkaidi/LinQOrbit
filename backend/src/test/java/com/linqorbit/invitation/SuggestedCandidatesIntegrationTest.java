package com.linqorbit.invitation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;

/**
 * Candidats suggérés, invitation et invitations du candidat (T-101, D85 ;
 * consentement et identité T-102, D86) sur PostgreSQL réel : contenu de la carte,
 * droits (401/403/404), états de l'offre (409), double invitation —
 * y compris concurrente — et visibilité côté candidat. Les suggestions sont
 * posées par SQL (leur calcul est couvert par {@code ScreeningJobIntegrationTest}).
 */
class SuggestedCandidatesIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";
    private static final String SUGGESTED = "/api/v1/job-offers/{offerId}/suggested-candidates";
    private static final String INVITE = SUGGESTED + "/{suggestionId}/invitations";
    private static final String MY_INVITATIONS = "/api/v1/candidates/me/invitations";

    /** Fiche riche en identité : tout ce qui n'est pas dans la liste blanche doit disparaître. */
    private static final String RICH_CONTENT = """
            {"schemaVersion":"3","firstName":"Jeanne","lastName":"Secretan","email":"jeanne.secretan@example.com",
             "phone":"+33 6 99 88 77 66","title":"Senior Backend Engineer","seniority":"senior",
             "yearsOfExperience":9,"targetRole":"Staff Engineer",
             "summary":"Led the payments platform at ACME-CORP for years",
             "location":{"city":"Lyon","country":"France"},
             "skills":[
               {"name":"Java","category":"hard_skill","level":5,"yearsExperience":9},
               {"name":"Leadership","category":"soft_skill","level":5,"yearsExperience":9},
               {"name":"PostgreSQL","category":"hard_skill","level":4,"yearsExperience":7},
               {"name":"Kafka","category":"hard_skill","level":3,"yearsExperience":2},
               {"name":"Docker","category":"hard_skill","level":3,"yearsExperience":5},
               {"name":"Spring","category":"hard_skill","level":4,"yearsExperience":8},
               {"name":"Kubernetes","category":"hard_skill","level":2},
               {"name":"Terraform","category":"hard_skill","level":1},
               {"name":"Go","category":"hard_skill","level":2,"yearsExperience":1},
               {"name":"Rust","category":"hard_skill"},
               {"name":"Python","category":"hard_skill","level":1,"yearsExperience":3}],
             "experiences":[{"positionTitle":"Tech Lead","companyName":"ACME-CORP","domain":"fintech",
                             "responsibilities":["Ran the SECRET-ONCALL rota"]}],
             "diplomas":[{"institution":"Sorbonne University","degree":"Master"}],
             "certifications":[{"name":"CKA","issuer":"CNCF-ISSUER"}],
             "projects":[{"name":"Project Hidden"}],
             "links":[{"url":"https://github.com/jeannesecretan","linkType":"github"}]}""";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private EmbeddingTestData data;
    private OfferFixture offer;
    private UUID offerId;
    private UUID offerFiche;
    private UUID screeningJobId;
    private int nextRank;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        offer = data.publishedOffer();
        offerId = offer.offerId();
        offerFiche = data.offerFiche(offerId, 1, OFFER_CONTENT);
        screeningJobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at)
                VALUES (?, ?, ?, 3, 1, now(), 0, now(), now())""", screeningJobId, offerId, offerFiche);
        nextRank = 1;
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    // --- aides -----------------------------------------------------------------------

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    /** Suggestion de l'offre : un candidat, sa fiche (contenu donné) et la ligne figée du screening. */
    private Suggestion suggest(String content) {
        UUID candidateId = data.candidate(null);
        UUID fiche = data.candidateFiche(candidateId, 1, content);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0.1, 1, now())""",
                id, offerId, candidateId, fiche, screeningJobId, nextRank++);
        return new Suggestion(id, candidateId, fiche);
    }

    private record Suggestion(UUID id, UUID candidateId, UUID ficheId) {
    }

    private void invited(Suggestion suggestion) {
        jdbc.update("""
                UPDATE offer_candidate SET status = 2, invited_by_user_id = ?, invited_at = now() WHERE id = ?""",
                offer.creatorId(), suggestion.id());
    }

    private String storedStatus(UUID suggestionId) {
        return jdbc.queryForObject("SELECT status FROM offer_candidate WHERE id = ?", String.class, suggestionId);
    }

    private String list(UUID asUser) throws Exception {
        return mockMvc.perform(get(SUGGESTED, offerId).with(as(asUser)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    // --- liste : contenu de la carte ------------------------------------------------------------

    @Test
    void theCardCarriesTheNameAndTheWhitelistedFieldsAndLeaksNothingElse() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);

        String body = list(offer.creatorId());

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(suggestion.id().toString()))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[0].firstName").value("Embedding"))
                .andExpect(jsonPath("$.items[0].lastName").value("IT"))
                .andExpect(jsonPath("$.items[0].title").value("Senior Backend Engineer"))
                .andExpect(jsonPath("$.items[0].seniority").value("senior"))
                .andExpect(jsonPath("$.items[0].yearsOfExperience").value(9))
                .andExpect(jsonPath("$.items[0].country").value("France"))
                .andExpect(jsonPath("$.items[0].status").value("suggested"));
        // Le nom vient du compte (le candidat a consenti) ; la fiche, elle, ne fuit toujours rien
        // au-delà de la liste blanche, et jamais d'e-mail ni de téléphone.
        assertThat(body).doesNotContain("Jeanne", "Secretan", "jeanne.secretan", "embedding-it-", "+33", "ACME-CORP", "Sorbonne",
                "github", "Lyon", "Led the payments", "SECRET-ONCALL", "CNCF-ISSUER", "Project Hidden",
                "Staff Engineer", "fintech", "Tech Lead", "Leadership",
                suggestion.candidateId().toString(), suggestion.ficheId().toString());
        // Aucun champ hors liste blanche, même vide : la forme de la carte est fixe.
        assertThat(body).doesNotContain("candidateId", "normalizedProfileId", "email", "phone", "distance",
                "summary");
    }

    @Test
    void skillsAreCappedAtEightSortedByLevelThenYearsAndSoftSkillsAreDropped() throws Exception {
        suggest(RICH_CONTENT);

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items[0].skills.length()").value(8))
                .andExpect(jsonPath("$.items[0].skills[0].name").value("Java"))
                .andExpect(jsonPath("$.items[0].skills[0].level").value(5))
                .andExpect(jsonPath("$.items[0].skills[1].name").value("Spring"))
                .andExpect(jsonPath("$.items[0].skills[2].name").value("PostgreSQL"))
                .andExpect(jsonPath("$.items[0].skills[3].name").value("Docker"))
                .andExpect(jsonPath("$.items[0].skills[4].name").value("Kafka"))
                .andExpect(jsonPath("$.items[0].skills[5].name").value("Go"))
                .andExpect(jsonPath("$.items[0].skills[6].name").value("Kubernetes"))
                .andExpect(jsonPath("$.items[0].skills[7].name").value("Python"));
    }

    @Test
    void theListIsLoadedInBatchSoTheNumberOfQueriesDoesNotGrowWithTheNumberOfCandidates() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            suggest(RICH_CONTENT);
            suggest(RICH_CONTENT);
            list(offer.creatorId()); // échauffement : métadonnées et caches paresseux hors mesure
            long withTwo = queriesForOneList(statistics);

            for (int i = 0; i < 10; i++) {
                suggest(RICH_CONTENT);
            }
            long withTwelve = queriesForOneList(statistics);

            assertThat(withTwo).isPositive();
            assertThat(withTwelve).isEqualTo(withTwo);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    @Test
    void anOfferWithoutSuggestionAnswersAnEmptyListWithFewerQueriesThanAFilledOne() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            list(offer.creatorId()); // échauffement
            long empty = queriesForOneList(statistics);
            suggest(RICH_CONTENT);
            long filled = queriesForOneList(statistics);

            mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                    .andExpect(jsonPath("$.items.length()").value(1));
            assertThat(empty).isLessThan(filled);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    /** Requêtes JDBC préparées pendant une lecture de la liste (statistiques Hibernate remises à zéro avant). */
    private long queriesForOneList(Statistics statistics) throws Exception {
        statistics.clear();
        list(offer.creatorId());
        return statistics.getPrepareStatementCount();
    }

    @Test
    void aSparseOrOddFicheStillGivesACardWithoutFailing() throws Exception {
        Suggestion onlyTitle = suggest("{\"schemaVersion\":\"3\",\"title\":\"  Data Analyst \"}");
        Suggestion empty = suggest("{}");
        Suggestion notAnObject = suggest("[]");
        Suggestion wrongTypes = suggest("""
                {"title":42,"seniority":["x"],"yearsOfExperience":"nine","location":"France",
                 "skills":[{"name":null},{"level":3},"Java",{"name":"Go","level":"high"}]}""");

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[0].id").value(onlyTitle.id().toString()))
                .andExpect(jsonPath("$.items[0].title").value("Data Analyst"))
                .andExpect(jsonPath("$.items[0].skills").isEmpty())
                .andExpect(jsonPath("$.items[1].id").value(empty.id().toString()))
                .andExpect(jsonPath("$.items[1].title").value((Object) null))
                .andExpect(jsonPath("$.items[2].id").value(notAnObject.id().toString()))
                .andExpect(jsonPath("$.items[2].skills").isEmpty())
                .andExpect(jsonPath("$.items[3].id").value(wrongTypes.id().toString()))
                .andExpect(jsonPath("$.items[3].title").value((Object) null))
                .andExpect(jsonPath("$.items[3].yearsOfExperience").value((Object) null))
                .andExpect(jsonPath("$.items[3].country").value((Object) null))
                .andExpect(jsonPath("$.items[3].skills.length()").value(1))
                .andExpect(jsonPath("$.items[3].skills[0].name").value("Go"))
                .andExpect(jsonPath("$.items[3].skills[0].level").value((Object) null));
    }

    @Test
    void cardsComeInScreeningRankOrderWhateverTheInsertionOrder() throws Exception {
        Suggestion first = suggest(RICH_CONTENT);
        Suggestion second = suggest(RICH_CONTENT);
        Suggestion third = suggest(RICH_CONTENT);
        jdbc.update("UPDATE offer_candidate SET rank = 3 WHERE id = ?", first.id());
        jdbc.update("UPDATE offer_candidate SET rank = 1 WHERE id = ?", third.id());

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items[0].id").value(third.id().toString()))
                .andExpect(jsonPath("$.items[0].rank").value(1))
                .andExpect(jsonPath("$.items[1].id").value(second.id().toString()))
                .andExpect(jsonPath("$.items[2].id").value(first.id().toString()));
    }

    @Test
    void noSuggestionIsAnEmptyList() throws Exception {
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void theStatusIsSuggestedInvitedOrAppliedAndAppliedWinsWhateverTheStoredStatus() throws Exception {
        Suggestion plain = suggest(RICH_CONTENT);
        Suggestion invitedOne = suggest(RICH_CONTENT);
        invited(invitedOne);
        Suggestion appliedOne = suggest(RICH_CONTENT);
        data.application(appliedOne.candidateId(), offerId, 2);
        Suggestion invitedThenApplied = suggest(RICH_CONTENT);
        invited(invitedThenApplied);
        data.application(invitedThenApplied.candidateId(), offerId, 1);

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items[0].id").value(plain.id().toString()))
                .andExpect(jsonPath("$.items[0].status").value("suggested"))
                .andExpect(jsonPath("$.items[1].status").value("invited"))
                .andExpect(jsonPath("$.items[2].status").value("applied"))
                .andExpect(jsonPath("$.items[3].status").value("applied"));
    }

    // --- liste : droits et états ------------------------------------------------------------------

    @Test
    void canInviteFollowsTheManagementRight() throws Exception {
        suggest(RICH_CONTENT);
        UUID owner = data.recruiterIn(offer.companyId(), true);
        UUID plainMember = data.recruiterIn(offer.companyId(), false);

        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.canInvite").value(true));
        mockMvc.perform(get(SUGGESTED, offerId).with(as(owner)))
                .andExpect(jsonPath("$.canInvite").value(true));
        mockMvc.perform(get(SUGGESTED, offerId).with(as(plainMember)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canInvite").value(false))
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void listRights() throws Exception {
        OfferFixture foreign = data.publishedOffer();

        mockMvc.perform(get(SUGGESTED, offerId)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(SUGGESTED, offerId).with(as(foreign.creatorId()))).andExpect(status().isNotFound());
        mockMvc.perform(get(SUGGESTED, offerId).with(as(data.loneRecruiter()))).andExpect(status().isNotFound());
        mockMvc.perform(get(SUGGESTED, offerId).with(as(data.candidate(null)))).andExpect(status().isNotFound());
        mockMvc.perform(get(SUGGESTED, UUID.randomUUID()).with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void anOfferThatIsNotOpenGivesAConflictNotAList() throws Exception {
        suggest(RICH_CONTENT);
        OfferFixture draft = data.offer(EmbeddingTestData.DRAFT, null);
        OfferFixture closed = data.offer(EmbeddingTestData.CLOSED, null);
        OfferFixture expired = data.offer(EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        OfferFixture lastDay = data.offer(EmbeddingTestData.PUBLISHED, LocalDate.now());

        for (OfferFixture notOpen : List.of(draft, closed, expired)) {
            mockMvc.perform(get(SUGGESTED, notOpen.offerId()).with(as(notOpen.creatorId())))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.detail").isNotEmpty());
        }
        mockMvc.perform(get(SUGGESTED, lastDay.offerId()).with(as(lastDay.creatorId())))
                .andExpect(status().isOk());
        data.setOfferStatus(offerId, EmbeddingTestData.CLOSED, null);
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId()))).andExpect(status().isConflict());
    }

    // --- invitation -----------------------------------------------------------------------------------

    @Test
    void invitingTurnsTheSuggestionIntoAnInvitationAndRecordsWhoAndWhen() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);

        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(suggestion.id().toString()))
                .andExpect(jsonPath("$.status").value("invited"))
                .andExpect(jsonPath("$.title").value("Senior Backend Engineer"));

        assertThat(storedStatus(suggestion.id())).isEqualTo("2");
        assertThat(jdbc.queryForObject("SELECT invited_by_user_id FROM offer_candidate WHERE id = ?", UUID.class,
                suggestion.id())).isEqualTo(offer.creatorId());
        assertThat(jdbc.queryForObject("SELECT invited_at IS NOT NULL FROM offer_candidate WHERE id = ?",
                Boolean.class, suggestion.id())).isTrue();
        mockMvc.perform(get(SUGGESTED, offerId).with(as(offer.creatorId())))
                .andExpect(jsonPath("$.items[0].status").value("invited"));
    }

    @Test
    void invitingReturnsTheCardWithoutContactDetailsOrInternalIds() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);

        String body = mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("Embedding").doesNotContain("Jeanne", "Secretan", "ACME-CORP", "embedding-it-",
                "phone", suggestion.candidateId().toString(),
                suggestion.ficheId().toString());
    }

    @Test
    void invitingTwiceIsAConflictAndKeepsTheFirstInvitation() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andExpect(status().isCreated());
        UUID owner = data.recruiterIn(offer.companyId(), true);

        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(owner)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").isNotEmpty());

        assertThat(jdbc.queryForObject("SELECT invited_by_user_id FROM offer_candidate WHERE id = ?", UUID.class,
                suggestion.id())).isEqualTo(offer.creatorId());
    }

    @Test
    void twoConcurrentInvitationsHaveExactlyOneWinner() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        UUID owner = data.recruiterIn(offer.companyId(), true);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Integer>> results = new ArrayList<>();
            for (UUID inviter : List.of(offer.creatorId(), owner)) {
                Callable<Integer> call = () -> {
                    start.await();
                    return mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(inviter)))
                            .andReturn().getResponse().getStatus();
                };
                results.add(pool.submit(call));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) {
                statuses.add(result.get(30, TimeUnit.SECONDS));
            }

            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(storedStatus(suggestion.id())).isEqualTo("2");
    }

    @Test
    void aCandidateWhoAlreadyAppliedCannotBeInvited() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        data.application(suggestion.candidateId(), offerId, 2);

        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andExpect(status().isConflict());

        assertThat(storedStatus(suggestion.id())).isEqualTo("1");
    }

    @Test
    void anUnknownSuggestionOrOneFromAnotherOfferIsNotFound() throws Exception {
        Suggestion mine = suggest(RICH_CONTENT);
        OfferFixture sibling = data.offer(EmbeddingTestData.PUBLISHED, null);
        data.recruiterIn(sibling.companyId(), true);

        mockMvc.perform(post(INVITE, offerId, UUID.randomUUID()).with(as(offer.creatorId())))
                .andExpect(status().isNotFound());
        // Une suggestion de l'offre A ne s'invite jamais par le chemin de l'offre B, même pour son créateur.
        mockMvc.perform(post(INVITE, sibling.offerId(), mine.id()).with(as(sibling.creatorId())))
                .andExpect(status().isNotFound());
        assertThat(storedStatus(mine.id())).isEqualTo("1");
    }

    @Test
    void inviteRights() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        UUID plainMember = data.recruiterIn(offer.companyId(), false);
        OfferFixture foreign = data.publishedOffer();

        mockMvc.perform(post(INVITE, offerId, suggestion.id())).andExpect(status().isUnauthorized());
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(plainMember)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(foreign.creatorId())))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(data.loneRecruiter())))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(data.candidate(null))))
                .andExpect(status().isNotFound());
        assertThat(storedStatus(suggestion.id())).isEqualTo("1");

        UUID owner = data.recruiterIn(offer.companyId(), true);
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(owner))).andExpect(status().isCreated());
    }

    @Test
    void anOfferThatIsNoLongerOpenRefusesInvitations() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        data.setOfferStatus(offerId, EmbeddingTestData.CLOSED, null);

        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andExpect(status().isConflict());
        data.setOfferStatus(offerId, EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        mockMvc.perform(post(INVITE, offerId, suggestion.id()).with(as(offer.creatorId())))
                .andExpect(status().isConflict());

        assertThat(storedStatus(suggestion.id())).isEqualTo("1");
    }

    // --- invitations du candidat ---------------------------------------------------------------------------

    @Test
    void aCandidateSeesOnlyTheOpenOffersHeWasInvitedToWithoutHavingAppliedNewestFirst() throws Exception {
        Suggestion older = suggest(RICH_CONTENT);
        invited(older);
        jdbc.update("UPDATE offer_candidate SET invited_at = now() - interval '2 days' WHERE id = ?", older.id());
        UUID candidateId = older.candidateId();

        OfferFixture second = data.publishedOffer();
        Suggestion newer = invitedIn(second, candidateId, 1);
        OfferFixture closed = data.publishedOffer();
        invitedIn(closed, candidateId, 1);
        data.setOfferStatus(closed.offerId(), EmbeddingTestData.CLOSED, null);
        OfferFixture expired = data.publishedOffer();
        invitedIn(expired, candidateId, 1);
        data.setOfferStatus(expired.offerId(), EmbeddingTestData.PUBLISHED, LocalDate.now().minusDays(1));
        OfferFixture draftOffer = data.publishedOffer();
        invitedIn(draftOffer, candidateId, 1);
        data.setOfferStatus(draftOffer.offerId(), EmbeddingTestData.DRAFT, null);
        OfferFixture applied = data.publishedOffer();
        invitedIn(applied, candidateId, 1);
        data.application(candidateId, applied.offerId(), 2);
        OfferFixture drafted = data.publishedOffer();
        invitedIn(drafted, candidateId, 1);
        data.application(candidateId, drafted.offerId(), 1);
        OfferFixture stillSuggested = data.publishedOffer();
        suggestedIn(stillSuggested, candidateId);

        String body = mockMvc.perform(get(MY_INVITATIONS).with(as(candidateId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(newer.id().toString()))
                .andExpect(jsonPath("$[0].job.publicId").value(publicIdOf(second.offerId())))
                .andExpect(jsonPath("$[0].job.slug").value("embedding-it-offer"))
                .andExpect(jsonPath("$[0].job.title").value("Embedding IT offer"))
                .andExpect(jsonPath("$[0].job.companyName").value("Embedding IT " + second.companyId()))
                .andExpect(jsonPath("$[0].invitedAt").isNotEmpty())
                .andExpect(jsonPath("$[1].id").value(older.id().toString()))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("rank", "distance", "candidateId", "invitedBy",
                offer.creatorId().toString(), candidateId.toString());
    }

    @Test
    void applyingMakesTheInvitationDisappearFromTheList() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        invited(suggestion);
        mockMvc.perform(get(MY_INVITATIONS).with(as(suggestion.candidateId())))
                .andExpect(jsonPath("$.length()").value(1));

        data.application(suggestion.candidateId(), offerId, 1);

        mockMvc.perform(get(MY_INVITATIONS).with(as(suggestion.candidateId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void aCandidateNeverSeesTheInvitationsOfSomeoneElseAndNoInvitationIsAnEmptyArray() throws Exception {
        Suggestion suggestion = suggest(RICH_CONTENT);
        invited(suggestion);
        UUID other = data.candidate(null);

        mockMvc.perform(get(MY_INVITATIONS).with(as(other)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get(MY_INVITATIONS).with(as(data.loneRecruiter())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void invitationsRequireAToken() throws Exception {
        mockMvc.perform(get(MY_INVITATIONS)).andExpect(status().isUnauthorized());
    }

    private String publicIdOf(UUID id) {
        return jdbc.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, id);
    }

    /** Ligne INVITED d'un candidat existant sur une autre offre (job de recherche et fiche d'offre dédiés). */
    private Suggestion invitedIn(OfferFixture other, UUID candidateId, int rank) {
        Suggestion suggestion = suggestedIn(other, candidateId);
        jdbc.update("""
                UPDATE offer_candidate SET status = 2, invited_by_user_id = ?, invited_at = now() WHERE id = ?""",
                other.creatorId(), suggestion.id());
        return suggestion;
    }

    private Suggestion suggestedIn(OfferFixture other, UUID candidateId) {
        UUID fiche = jdbc.queryForObject("""
                SELECT candidate_normalized_profile_id FROM offer_candidate WHERE candidate_id = ? LIMIT 1""",
                UUID.class, candidateId);
        UUID otherFiche = data.offerFiche(other.offerId(), 1, OFFER_CONTENT);
        UUID jobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at)
                VALUES (?, ?, ?, 3, 1, now(), 1, now(), now())""", jobId, other.offerId(), otherFiche);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, created_at)
                VALUES (?, ?, ?, ?, ?, 1, 0.1, 1, now())""", id, other.offerId(), candidateId, fiche, jobId);
        return new Suggestion(id, candidateId, fiche);
    }
}
