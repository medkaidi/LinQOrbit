package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;

/**
 * Files de modération du tableau de bord admin ({@code moderation} de {@code GET /api/v1/admin/dashboard}) :
 * signalements IA « à relire par moi » (ni auteur, ni déjà relu) et total, sur PostgreSQL réel. La base de
 * dev est partagée : chaque compteur est mesuré par écart, et épinglé contre la liste
 * {@code GET /admin/criterion-reports} (avis de l'admin courant + auteur).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminDashboardModerationIntegrationTest extends RecruiterApplicationTestSupport {

    private static final String DASHBOARD = "/api/v1/admin/dashboard";
    private static final String REPORTS_PATH = "/api/v1/admin/criterion-reports";

    private record Admin(String token, UUID userId, String email) {
    }

    @Test
    void aNewReportWaitsForEveryAdminExceptItsAuthorAndDropsOnceReviewed() throws Exception {
        Admin reviewer = admin();
        Admin other = admin();
        JsonNode reviewerBefore = moderation(reviewer);
        JsonNode otherBefore = moderation(other);

        UUID reportId = newReport();

        // Un signalement de plus pour chaque admin, qui n'en est pas l'auteur.
        assertThat(delta(moderation(reviewer), reviewerBefore, "reportsAwaitingMyReview")).isEqualTo(1);
        assertThat(delta(moderation(reviewer), reviewerBefore, "reportsTotal")).isEqualTo(1);
        assertThat(delta(moderation(other), otherBefore, "reportsAwaitingMyReview")).isEqualTo(1);

        review(reviewer, reportId).andExpect(status().isCreated());

        // Relu par moi : il sort de ma file, pas de celle de l'autre admin ; le total ne bouge pas.
        assertThat(delta(moderation(reviewer), reviewerBefore, "reportsAwaitingMyReview")).isZero();
        assertThat(delta(moderation(other), otherBefore, "reportsAwaitingMyReview")).isEqualTo(1);
        assertThat(delta(moderation(reviewer), reviewerBefore, "reportsTotal")).isEqualTo(1);
    }

    @Test
    void anAdminDoesNotSeeHisOwnReportInHisQueueButItStaysInTheTotal() throws Exception {
        Admin author = admin();
        Admin other = admin();
        JsonNode authorBefore = moderation(author);
        JsonNode otherBefore = moderation(other);

        UUID reportId = newReport();
        setAuthor(reportId, author.userId());

        assertThat(delta(moderation(author), authorBefore, "reportsAwaitingMyReview")).isZero();
        assertThat(delta(moderation(author), authorBefore, "reportsTotal")).isEqualTo(1);
        assertThat(delta(moderation(other), otherBefore, "reportsAwaitingMyReview")).isEqualTo(1);
    }

    @Test
    void theCountersEqualWhatTheReportListShowsToTheCurrentAdmin() throws Exception {
        Admin me = admin();
        Admin other = admin();
        UUID first = newReport();
        UUID second = newReport();
        UUID third = newReport();
        review(me, first).andExpect(status().isCreated()); // relu par moi
        review(other, second).andExpect(status().isCreated()); // relu par l'autre : encore à moi
        setAuthor(third, me.userId()); // le mien : jamais à relire par moi

        JsonNode body = moderation(me);

        long total = 0;
        long awaiting = 0;
        int page = 0;
        while (true) {
            JsonNode list = json(me, REPORTS_PATH + "?page=" + page);
            for (JsonNode item : list.get("items")) {
                total++;
                if (item.get("myReviewVerdict").isNull()
                        && !me.email().equals(item.get("authorEmail").asText())) {
                    awaiting++;
                }
            }
            page++;
            if ((long) page * list.get("size").asInt() >= list.get("total").asLong()) {
                break;
            }
        }
        assertThat(body.get("reportsTotal").asLong()).isEqualTo(total);
        assertThat(body.get("reportsAwaitingMyReview").asLong()).isEqualTo(awaiting);
        assertThat(body.get("reportsAwaitingMyReview").asLong()).isLessThanOrEqualTo(body.get("reportsTotal").asLong());
    }

    // --- aides -----------------------------------------------------------------------

    private JsonNode moderation(Admin admin) throws Exception {
        return json(admin, DASHBOARD).get("moderation");
    }

    private static long delta(JsonNode after, JsonNode before, String field) {
        return after.get(field).asLong() - before.get(field).asLong();
    }

    private JsonNode json(Admin admin, String path) throws Exception {
        String body = mockMvc.perform(get(path).header("Authorization", "Bearer " + admin.token()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    /** Un signalement neuf d'un recruteur sur un critère d'une candidature évaluée. */
    private UUID newReport() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID applicationId = draftAndMatch(candidate, uploadCv(candidate.token()), publicIdOf(offerId),
                resultJson(60, 70, 80, 90, 95), List.of(), null);
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId + "/criterion-reports")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"criterionKey\": \"skill:java\", \"reason\": \"scoreIncorrect\"}"))
                .andExpect(status().isCreated());
        return jdbcTemplate.queryForObject("""
                SELECT r.id FROM matching_criterion_report r
                JOIN application a ON a.matching_id = r.matching_id
                WHERE a.id = ? AND r.criterion_key = 'skill:java'""", UUID.class, applicationId);
    }

    private ResultActions review(Admin admin, UUID reportId) throws Exception {
        return mockMvc.perform(post(REPORTS_PATH + "/" + reportId + "/reviews")
                .header("Authorization", "Bearer " + admin.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"verdict\": \"upheld\"}"));
    }

    /** Les tables de signalement sont append-only (V27) : le test suspend les triggers le temps de la mise en scène. */
    private void setAuthor(UUID reportId, UUID authorUserId) {
        setAppendOnlyTriggers(false);
        try {
            jdbcTemplate.update("UPDATE matching_criterion_report SET author_user_id = ? WHERE id = ?",
                    authorUserId, reportId);
        } finally {
            setAppendOnlyTriggers(true);
        }
    }

    /** Compte ADMIN : le rôle est inséré après le signup, donc un nouveau login porte le claim {@code roles}. */
    private Admin admin() throws Exception {
        String email = "admin-dashboard-it-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Admin",
                                  "lastName": "Zadmin",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(signup.getResponse().getContentAsString())
                .get("user").get("id").asText());
        createdUserIds.add(id);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", id);
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"%s\", \"password\": \"secret123\"}".formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();
        return new Admin(token, id, email);
    }
}
