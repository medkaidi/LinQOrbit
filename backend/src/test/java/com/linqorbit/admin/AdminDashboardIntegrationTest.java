package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.embedding.EmbeddingTestData.OfferFixture;

/**
 * Tableau de bord admin ({@code GET /api/v1/admin/dashboard}) sur PostgreSQL réel : comptes par statut
 * et identités, nouveaux comptes (fenêtre de 7 jours), offres par statut et offres ouvertes, candidatures
 * visibles (brouillons et retraits exclus) et nouvelles, suggestions de compétences, 401/403 et nombre de
 * requêtes constant. La base de dev est partagée : chaque compteur est mesuré par <b>écart</b> avant /
 * après les données du test, et épinglé contre la liste admin dont il est le total (égalité absolue).
 * Les signalements IA à relire ont leur propre classe ({@code AdminDashboardModerationIntegrationTest}).
 */
class AdminDashboardIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String DASHBOARD = "/api/v1/admin/dashboard";

    private static final int DRAFT = 1;
    private static final int VALIDATED = 2;
    private static final int PUBLISHED = 3;
    private static final int CLOSED = 4;

    private static final int APP_DRAFT = 1;
    private static final int APP_SUBMITTED = 2;
    private static final int APP_WITHDRAWN = 3;
    private static final int APP_ACCEPTED = 4;
    private static final int APP_REJECTED = 5;

    private static final int ACTIVE = 1;
    private static final int INACTIVE = 2;
    private static final int SUSPENDED = 3;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private EmbeddingTestData data;
    private UUID adminId;
    private final List<UUID> adminIds = new ArrayList<>();
    private final List<UUID> suggestionAuthors = new ArrayList<>();

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        adminId = admin();
    }

    @AfterEach
    void cleanup() {
        for (UUID candidateId : suggestionAuthors) {
            jdbc.update("DELETE FROM skill_suggestions WHERE candidate_id = ?", candidateId);
        }
        for (UUID id : adminIds) {
            jdbc.update("DELETE FROM user_roles WHERE user_id = ?", id);
        }
        suggestionAuthors.clear();
        adminIds.clear();
        data.cleanup();
    }

    // --- aides -----------------------------------------------------------------------

    private UUID admin() {
        UUID id = data.bareUser();
        jdbc.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", id);
        adminIds.add(id);
        return id;
    }

    private static RequestPostProcessor asAdmin(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private JsonNode dashboard() throws Exception {
        String body = mockMvc.perform(get(DASHBOARD).with(asAdmin(adminId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private JsonNode json(String path) throws Exception {
        String body = mockMvc.perform(get(path).with(asAdmin(adminId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private long total(String path) throws Exception {
        return json(path).get("total").asLong();
    }

    private static long count(JsonNode dashboard, String block, String field) {
        return dashboard.get(block).get(field).asLong();
    }

    private void setUserStatus(UUID userId, int userStatus) {
        jdbc.update("UPDATE users SET status = ? WHERE id = ?", userStatus, userId);
    }

    private OfferFixture offer(int offerStatus, LocalDate expiresAt) {
        return data.offer(offerStatus, expiresAt);
    }

    private void applications(OfferFixture offer, int applicationStatus, int count) {
        for (int i = 0; i < count; i++) {
            data.application(data.candidate(null), offer.offerId(), applicationStatus);
        }
    }

    // --- comptes ---------------------------------------------------------------------

    @Test
    void accountsAreCountedByStatusAndIdentity() throws Exception {
        JsonNode before = dashboard();

        data.candidate(null);
        UUID inactive = data.candidate(null);
        setUserStatus(inactive, INACTIVE);
        UUID suspended = data.loneRecruiter();
        setUserStatus(suspended, SUSPENDED);
        data.loneRecruiter();
        admin();

        JsonNode after = dashboard();
        // 1 candidat actif + 1 recruteur actif + 2 admins (celui du test et le nouveau) hors de « before ».
        assertThat(count(after, "accounts", "active") - count(before, "accounts", "active")).isEqualTo(1 + 1 + 1);
        assertThat(count(after, "accounts", "inactive") - count(before, "accounts", "inactive")).isEqualTo(1);
        assertThat(count(after, "accounts", "suspended") - count(before, "accounts", "suspended")).isEqualTo(1);
        // Identités cumulables : jamais une somme des statuts.
        assertThat(count(after, "accounts", "candidates") - count(before, "accounts", "candidates")).isEqualTo(2);
        assertThat(count(after, "accounts", "recruiters") - count(before, "accounts", "recruiters")).isEqualTo(2);
        assertThat(count(after, "accounts", "admins") - count(before, "accounts", "admins")).isEqualTo(1);
    }

    @Test
    void accountCountersEqualTheTotalsOfTheAdminLists() throws Exception {
        data.candidate(null);
        setUserStatus(data.candidate(null), INACTIVE);
        data.loneRecruiter();

        JsonNode body = dashboard();

        assertThat(count(body, "accounts", "active")).isEqualTo(total("/api/v1/admin/users?status=active"));
        assertThat(count(body, "accounts", "inactive")).isEqualTo(total("/api/v1/admin/users?status=inactive"));
        assertThat(count(body, "accounts", "candidates"))
                .isEqualTo(total("/api/v1/admin/users?capability=candidate"));
        assertThat(count(body, "accounts", "recruiters"))
                .isEqualTo(total("/api/v1/admin/users?capability=recruiter"));
    }

    @Test
    void newAccountsOnlyCountTheLastSevenDays() throws Exception {
        JsonNode before = dashboard();

        data.candidate(null); // créé à l'instant
        UUID sixDays = data.candidate(null);
        jdbc.update("UPDATE users SET created_at = now() - interval '6 days' WHERE id = ?", sixDays);
        UUID eightDays = data.candidate(null);
        jdbc.update("UPDATE users SET created_at = now() - interval '8 days' WHERE id = ?", eightDays);

        JsonNode after = dashboard();
        assertThat(count(after, "accounts", "newLast7Days") - count(before, "accounts", "newLast7Days"))
                .isEqualTo(2);
        // Un compte ancien reste compté dans son statut.
        assertThat(count(after, "accounts", "active") - count(before, "accounts", "active")).isEqualTo(3);
    }

    // --- offres ----------------------------------------------------------------------

    @Test
    void offersAreCountedByStatusAndLiveOffersExcludeExpiredOnes() throws Exception {
        JsonNode before = dashboard();
        LocalDate today = LocalDate.now();

        offer(DRAFT, null);
        offer(VALIDATED, null);
        offer(PUBLISHED, null);
        offer(PUBLISHED, today.plusDays(10));
        offer(PUBLISHED, today); // l'échéance du jour est encore ouverte
        offer(PUBLISHED, today.minusDays(1)); // expirée : publiée mais plus ouverte
        offer(CLOSED, null);

        JsonNode after = dashboard();
        assertThat(count(after, "offers", "draft") - count(before, "offers", "draft")).isEqualTo(1);
        assertThat(count(after, "offers", "validated") - count(before, "offers", "validated")).isEqualTo(1);
        assertThat(count(after, "offers", "published") - count(before, "offers", "published")).isEqualTo(4);
        assertThat(count(after, "offers", "closed") - count(before, "offers", "closed")).isEqualTo(1);
        assertThat(after.get("liveOffers").asLong() - before.get("liveOffers").asLong()).isEqualTo(3);
    }

    @Test
    void offerCountersEqualTheTotalsOfTheAdminListAndTheJobBoard() throws Exception {
        offer(DRAFT, null);
        offer(VALIDATED, null);
        offer(PUBLISHED, LocalDate.now().plusDays(5));
        offer(PUBLISHED, LocalDate.now().minusDays(1));
        offer(CLOSED, null);

        JsonNode body = dashboard();

        assertThat(count(body, "offers", "draft")).isEqualTo(total("/api/v1/admin/job-offers?status=draft"));
        assertThat(count(body, "offers", "validated"))
                .isEqualTo(total("/api/v1/admin/job-offers?status=validated"));
        assertThat(count(body, "offers", "published"))
                .isEqualTo(total("/api/v1/admin/job-offers?status=published"));
        assertThat(count(body, "offers", "closed")).isEqualTo(total("/api/v1/admin/job-offers?status=closed"));
        assertThat(body.get("liveOffers").asLong()).isEqualTo(total("/api/v1/jobs"));
    }

    // --- candidatures ----------------------------------------------------------------

    @Test
    void applicationsExcludeDraftsAndWithdrawalsAndCountDecisions() throws Exception {
        JsonNode before = dashboard();
        OfferFixture offer = offer(PUBLISHED, null);

        applications(offer, APP_DRAFT, 2);
        applications(offer, APP_WITHDRAWN, 1);
        applications(offer, APP_SUBMITTED, 3);
        applications(offer, APP_ACCEPTED, 2);
        applications(offer, APP_REJECTED, 1);

        JsonNode after = dashboard();
        assertThat(count(after, "applications", "toReview") - count(before, "applications", "toReview"))
                .isEqualTo(3);
        assertThat(count(after, "applications", "accepted") - count(before, "applications", "accepted"))
                .isEqualTo(2);
        assertThat(count(after, "applications", "rejected") - count(before, "applications", "rejected"))
                .isEqualTo(1);
        // Visibles transmises à l'instant : 3 + 2 + 1 ; brouillons (sans date) et retrait exclus.
        assertThat(count(after, "applications", "newLast7Days") - count(before, "applications", "newLast7Days"))
                .isEqualTo(6);
    }

    @Test
    void newApplicationsOnlyCountTheLastSevenDays() throws Exception {
        OfferFixture offer = offer(PUBLISHED, null);
        JsonNode before = dashboard();

        data.application(data.candidate(null), offer.offerId(), APP_SUBMITTED, 6);
        data.application(data.candidate(null), offer.offerId(), APP_ACCEPTED, 8);
        data.application(data.candidate(null), offer.offerId(), APP_SUBMITTED, 30);

        JsonNode after = dashboard();
        // Seule la transmise d'il y a 6 jours est « nouvelle » ; les anciennes restent dans leur statut.
        assertThat(count(after, "applications", "newLast7Days") - count(before, "applications", "newLast7Days"))
                .isEqualTo(1);
        assertThat(count(after, "applications", "toReview") - count(before, "applications", "toReview"))
                .isEqualTo(2);
        assertThat(count(after, "applications", "accepted") - count(before, "applications", "accepted"))
                .isEqualTo(1);
    }

    // --- suggestions de compétences ---------------------------------------------------

    @Test
    void skillSuggestionsEqualTheLengthOfTheAdminQueue() throws Exception {
        JsonNode before = dashboard();
        UUID first = data.candidate(null);
        UUID second = data.candidate(null);
        suggestionAuthors.add(first);
        suggestionAuthors.add(second);
        // Deux auteurs proposent le même nom : la file garde une ligne par suggestion, le compteur aussi.
        for (UUID author : List.of(first, second)) {
            jdbc.update("INSERT INTO skill_suggestions (id, candidate_id, name, created_at) VALUES (?, ?, ?, now())",
                    UUID.randomUUID(), author, "Dashboard IT skill");
        }

        JsonNode after = dashboard();
        assertThat(count(after, "moderation", "skillSuggestions") - count(before, "moderation", "skillSuggestions"))
                .isEqualTo(2);
        assertThat(count(after, "moderation", "skillSuggestions"))
                .isEqualTo(json("/api/v1/admin/skill-suggestions").size());
    }

    // --- accès -----------------------------------------------------------------------

    @Test
    void theDashboardRequiresAToken() throws Exception {
        mockMvc.perform(get(DASHBOARD)).andExpect(status().isUnauthorized());
    }

    @Test
    void anAccountWithoutTheAdminRoleGetsA403() throws Exception {
        UUID recruiter = data.loneRecruiter();
        mockMvc.perform(get(DASHBOARD).with(jwt().jwt(token -> token.subject(recruiter.toString()))))
                .andExpect(status().isForbidden());
    }

    // --- coût ------------------------------------------------------------------------

    @Test
    void theNumberOfQueriesDoesNotGrowWithTheVolume() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            populate(1);
            dashboard(); // échauffement : métadonnées hors mesure
            long withFew = queriesForOneRead(statistics);

            populate(8);
            long withMany = queriesForOneRead(statistics);

            assertThat(withMany).isEqualTo(withFew);
            assertThat(withFew).isLessThanOrEqualTo(17);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private long queriesForOneRead(Statistics statistics) throws Exception {
        statistics.clear();
        dashboard();
        return statistics.getPrepareStatementCount();
    }

    private void populate(int rounds) {
        for (int i = 0; i < rounds; i++) {
            OfferFixture offer = offer(PUBLISHED, null);
            applications(offer, APP_SUBMITTED, 2);
            applications(offer, APP_ACCEPTED, 1);
            data.loneRecruiter();
        }
    }
}
