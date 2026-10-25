package com.linqorbit.admin;

import static com.linqorbit.embedding.EmbeddingTestData.JOB_DONE;
import static com.linqorbit.embedding.EmbeddingTestData.JOB_FAILED;
import static com.linqorbit.embedding.EmbeddingTestData.JOB_PENDING;
import static com.linqorbit.embedding.EmbeddingTestData.JOB_SUPERSEDED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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
 * Traitements IA en échec du tableau de bord admin ({@code processingFailures} de
 * {@code GET /api/v1/admin/dashboard}) sur PostgreSQL réel. Un échec est un job FAILED (tentatives
 * épuisées) <b>encore d'actualité</b> : remplacé par une version postérieure, une fiche courante ou un
 * autre modèle, il ne compte plus. Un sujet n'est compté qu'une fois, quel que soit le nombre de
 * tentatives. La base de dev est partagée : chaque compteur est mesuré par <b>écart</b> avant / après.
 */
class AdminDashboardProcessingIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String DASHBOARD = "/api/v1/admin/dashboard";
    private static final String CONTENT = "{}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    private EmbeddingTestData data;
    private UUID adminId;
    private final List<UUID> adminIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        adminId = data.bareUser();
        jdbc.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", adminId);
        adminIds.add(adminId);
    }

    @AfterEach
    void cleanup() {
        for (UUID id : adminIds) {
            jdbc.update("DELETE FROM user_roles WHERE user_id = ?", id);
        }
        adminIds.clear();
        data.cleanup();
    }

    // --- aides -----------------------------------------------------------------------

    private JsonNode failures() throws Exception {
        String body = mockMvc.perform(get(DASHBOARD)
                        .with(jwtOf(adminId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("processingFailures");
    }

    private static RequestPostProcessor jwtOf(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static long delta(JsonNode after, JsonNode before, String field) {
        return after.get(field).asLong() - before.get(field).asLong();
    }

    /** Aucun autre compteur ne bouge. */
    private static void onlyMoved(JsonNode after, JsonNode before, String moved, long by) {
        for (String field : List.of("candidateAnalyses", "offerAnalyses", "embeddings", "screenings", "matchings")) {
            assertThat(delta(after, before, field)).as(field).isEqualTo(field.equals(moved) ? by : 0);
        }
    }

    // --- analyses de fiche -----------------------------------------------------------

    @Test
    void aCandidateWhoseLatestAnalysisFailedIsCountedOnceAndAReplacementClearsIt() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        UUID first = data.candidateFiche(candidate, 1, null);
        data.normalizationJob(first, true, JOB_FAILED);

        onlyMoved(failures(), before, "candidateAnalyses", 1);

        // Un deuxième échec sur la version suivante : toujours un seul candidat en échec.
        UUID second = data.candidateFiche(candidate, 2, null);
        data.normalizationJob(second, true, JOB_FAILED);
        onlyMoved(failures(), before, "candidateAnalyses", 1);

        // La version suivante réussit : le candidat n'est plus en échec (l'ancien FAILED est remplacé).
        jdbc.update("UPDATE normalization_job SET status = ? WHERE job_id = ?", JOB_DONE, second);
        onlyMoved(failures(), before, "candidateAnalyses", 0);
    }

    @Test
    void aFailedCandidateAnalysisOnAnOlderVersionIsReplacedByTheNewerOne() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        UUID first = data.candidateFiche(candidate, 1, null);
        data.normalizationJob(first, true, JOB_FAILED);
        UUID second = data.candidateFiche(candidate, 2, CONTENT);
        data.normalizationJob(second, true, JOB_DONE);

        onlyMoved(failures(), before, "candidateAnalyses", 0);
    }

    @Test
    void jobsThatAreNotExhaustedAreNotFailures() throws Exception {
        JsonNode before = failures();
        for (int status : new int[] {JOB_PENDING, 2, JOB_DONE, JOB_SUPERSEDED}) {
            UUID candidate = data.candidate(null);
            data.normalizationJob(data.candidateFiche(candidate, 1, CONTENT), true, status);
            OfferFixture offer = data.offer(EmbeddingTestData.DRAFT, null);
            data.normalizationJob(data.offerFiche(offer.offerId(), 1, CONTENT), false, status);
        }

        JsonNode after = failures();
        onlyMoved(after, before, "none", 0);
    }

    @Test
    void anOfferWhoseLatestAnalysisFailedIsCountedSeparatelyFromCandidates() throws Exception {
        JsonNode before = failures();
        OfferFixture offer = data.offer(EmbeddingTestData.DRAFT, null);
        UUID first = data.offerFiche(offer.offerId(), 1, null);
        data.normalizationJob(first, false, JOB_FAILED);
        UUID candidate = data.candidate(null);
        data.normalizationJob(data.candidateFiche(candidate, 1, null), true, JOB_FAILED);

        JsonNode after = failures();
        assertThat(delta(after, before, "offerAnalyses")).isEqualTo(1);
        assertThat(delta(after, before, "candidateAnalyses")).isEqualTo(1);

        // Une nouvelle validation de l'offre (version suivante) remplace l'échec.
        UUID second = data.offerFiche(offer.offerId(), 2, null);
        data.normalizationJob(second, false, JOB_PENDING);
        assertThat(delta(failures(), before, "offerAnalyses")).isZero();
    }

    // --- embeddings ------------------------------------------------------------------

    @Test
    void aFailedEmbeddingOfTheActiveModelOnACurrentSheetIsCounted() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        data.embeddingJob(data.candidateFiche(candidate, 1, CONTENT), JOB_FAILED);
        OfferFixture offer = data.offer(EmbeddingTestData.PUBLISHED, null);
        data.embeddingJob(data.offerFiche(offer.offerId(), 1, CONTENT), JOB_FAILED);

        onlyMoved(failures(), before, "embeddings", 2);
    }

    @Test
    void anEmbeddingFailureThatIsNoLongerCurrentIsNotCounted() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        // Fiche remplacée par une version postérieure avec contenu.
        data.embeddingJob(data.candidateFiche(candidate, 1, CONTENT), JOB_FAILED);
        data.candidateFiche(candidate, 2, CONTENT);
        // Fiche sans contenu : pas une fiche courante, rien à vectoriser.
        UUID other = data.candidate(null);
        data.embeddingJob(data.candidateFiche(other, 1, null), JOB_FAILED);
        // Échec d'un autre modèle que le modèle actif.
        UUID third = data.candidate(null);
        data.embeddingJob(data.candidateFiche(third, 1, CONTENT), "another-model", JOB_FAILED);
        // Pas des échecs : en attente, terminé, remplacé.
        for (int status : new int[] {JOB_PENDING, JOB_DONE, JOB_SUPERSEDED}) {
            data.embeddingJob(data.candidateFiche(data.candidate(null), 1, CONTENT), status);
        }

        onlyMoved(failures(), before, "none", 0);
    }

    // --- screening -------------------------------------------------------------------

    @Test
    void aFailedScreeningOnTheCurrentOfferSheetIsCountedAndAReplacedSheetIsNot() throws Exception {
        JsonNode before = failures();
        OfferFixture offer = data.offer(EmbeddingTestData.PUBLISHED, null);
        UUID first = data.offerFiche(offer.offerId(), 1, CONTENT);
        data.screeningJob(offer.offerId(), first, JOB_FAILED);

        onlyMoved(failures(), before, "screenings", 1);

        // L'offre est revalidée : la fiche du job n'est plus la fiche courante.
        data.offerFiche(offer.offerId(), 2, CONTENT);
        onlyMoved(failures(), before, "screenings", 0);
    }

    @Test
    void screeningsThatAreNotExhaustedAreNotCounted() throws Exception {
        JsonNode before = failures();
        for (int status : new int[] {JOB_PENDING, 2, JOB_DONE, JOB_SUPERSEDED}) {
            OfferFixture offer = data.offer(EmbeddingTestData.PUBLISHED, null);
            data.screeningJob(offer.offerId(), data.offerFiche(offer.offerId(), 1, CONTENT), status);
        }

        onlyMoved(failures(), before, "none", 0);
    }

    // --- matching --------------------------------------------------------------------

    @Test
    void aMatchingWhoseLatestVersionFailedIsCountedOnceAndARetryClearsIt() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        OfferFixture offer = data.offer(EmbeddingTestData.PUBLISHED, null);
        UUID candidateSheet = data.candidateFiche(candidate, 1, CONTENT);
        UUID offerSheet = data.offerFiche(offer.offerId(), 1, CONTENT);
        UUID matching = data.matching(candidate, offer.offerId(), candidateSheet);

        data.matchingResult(matching, 1, offerSheet, JOB_FAILED);
        onlyMoved(failures(), before, "matchings", 1);

        // Deux échecs successifs : toujours un seul matching en échec.
        data.matchingResult(matching, 2, offerSheet, JOB_FAILED);
        onlyMoved(failures(), before, "matchings", 1);

        // La relance en cours, puis réussie : plus d'échec.
        data.matchingResult(matching, 3, offerSheet, JOB_PENDING);
        onlyMoved(failures(), before, "matchings", 0);
    }

    @Test
    void aSuccessfulMatchingThenAFailedRetryIsCountedButNotTheOtherWayRound() throws Exception {
        JsonNode before = failures();
        UUID candidate = data.candidate(null);
        OfferFixture offer = data.offer(EmbeddingTestData.PUBLISHED, null);
        UUID candidateSheet = data.candidateFiche(candidate, 1, CONTENT);
        UUID offerSheet = data.offerFiche(offer.offerId(), 1, CONTENT);
        UUID matching = data.matching(candidate, offer.offerId(), candidateSheet);

        data.matchingResult(matching, 1, offerSheet, JOB_FAILED);
        data.matchingResult(matching, 2, offerSheet, JOB_DONE);
        onlyMoved(failures(), before, "matchings", 0);

        UUID other = data.candidate(null);
        UUID otherSheet = data.candidateFiche(other, 1, CONTENT);
        UUID otherMatching = data.matching(other, offer.offerId(), otherSheet);
        data.matchingResult(otherMatching, 1, offerSheet, JOB_DONE);
        data.matchingResult(otherMatching, 2, offerSheet, JOB_FAILED);
        onlyMoved(failures(), before, "matchings", 1);
    }

    // --- forme -----------------------------------------------------------------------

    @Test
    void theBlockAlwaysCarriesTheFiveCountersAsNumbers() throws Exception {
        JsonNode block = failures();

        for (String field : List.of("candidateAnalyses", "offerAnalyses", "embeddings", "screenings", "matchings")) {
            assertThat(block.has(field)).as(field).isTrue();
            assertThat(block.get(field).isIntegralNumber()).as(field).isTrue();
            assertThat(block.get(field).asLong()).as(field).isGreaterThanOrEqualTo(0);
        }
    }
}
