package com.linqorbit.candidate.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;

/**
 * Consentement à la visibilité recruteur (T-102, D86) sur PostgreSQL réel :
 * défaut absent, accord / retrait / idempotence, date et version posées par le
 * serveur, aucun effet sur le dirty-flag du profil (updated_at intact), refus
 * sans profil, corps invalide et contraintes V30.
 */
class CandidateVisibilityIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String VISIBILITY = "/api/v1/candidates/me/visibility";

    @Autowired
    private MockMvc mockMvc;

    private EmbeddingTestData data;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private static RequestPostProcessor as(UUID userId) {
        return jwt().jwt(token -> token.subject(userId.toString()));
    }

    private void putConsent(UUID candidateId, String body, int expectedStatus) throws Exception {
        mockMvc.perform(put(VISIBILITY).with(as(candidateId)).contentType(MediaType.APPLICATION_JSON)
                .content(body)).andExpect(status().is(expectedStatus));
    }

    private Timestamp updatedAt(UUID candidateId) {
        return jdbc.queryForObject("SELECT updated_at FROM candidates WHERE id = ?", Timestamp.class, candidateId);
    }

    @Test
    void theConsentIsAbsentByDefaultWithOrWithoutAProfileRow() throws Exception {
        UUID withRow = data.candidateWithoutConsent(null);
        // Compte sans ligne candidates : même réponse, pas de 404 ni de création.
        UUID withoutRow = data.loneRecruiter();

        mockMvc.perform(get(VISIBILITY).with(as(withRow)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consented").value(false))
                .andExpect(jsonPath("$.consentedAt").value((Object) null));
        mockMvc.perform(get(VISIBILITY).with(as(withoutRow)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.consented").value(false));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM candidates WHERE id = ?", Integer.class, withoutRow))
                .isZero();
    }

    @Test
    void grantingStoresTheServerDateAndTheTextVersionAndWithdrawingClearsBoth() throws Exception {
        UUID candidate = data.candidateWithoutConsent(null);

        putConsent(candidate, "{\"consent\":true}", 200);

        mockMvc.perform(get(VISIBILITY).with(as(candidate)))
                .andExpect(jsonPath("$.consented").value(true))
                .andExpect(jsonPath("$.consentedAt").isNotEmpty());
        assertThat(jdbc.queryForObject(
                "SELECT recruiter_visibility_consent_version FROM candidates WHERE id = ?", Integer.class, candidate))
                .isEqualTo(3);
        assertThat(jdbc.queryForObject(
                "SELECT recruiter_visibility_consent_at IS NOT NULL FROM candidates WHERE id = ?", Boolean.class,
                candidate)).isTrue();

        putConsent(candidate, "{\"consent\":false}", 200);

        mockMvc.perform(get(VISIBILITY).with(as(candidate)))
                .andExpect(jsonPath("$.consented").value(false))
                .andExpect(jsonPath("$.consentedAt").value((Object) null));
        assertThat(jdbc.queryForObject("""
                SELECT recruiter_visibility_consent_at IS NULL AND recruiter_visibility_consent_version IS NULL
                FROM candidates WHERE id = ?""", Boolean.class, candidate)).isTrue();
    }

    @Test
    void theClientCannotChooseTheDateOrTheVersion() throws Exception {
        UUID candidate = data.candidateWithoutConsent(null);

        putConsent(candidate, "{\"consent\":true,\"consentedAt\":\"2000-01-01T00:00:00\",\"version\":99}", 200);

        assertThat(jdbc.queryForObject(
                "SELECT recruiter_visibility_consent_version FROM candidates WHERE id = ?", Integer.class, candidate))
                .isEqualTo(3);
        assertThat(jdbc.queryForObject(
                "SELECT recruiter_visibility_consent_at > now() - interval '1 minute' FROM candidates WHERE id = ?",
                Boolean.class, candidate)).isTrue();
    }

    @Test
    void repeatingTheSameAnswerIsIdempotentAndKeepsTheOriginalDate() throws Exception {
        UUID candidate = data.candidateWithoutConsent(null);
        putConsent(candidate, "{\"consent\":true}", 200);
        Timestamp first = jdbc.queryForObject(
                "SELECT recruiter_visibility_consent_at FROM candidates WHERE id = ?", Timestamp.class, candidate);

        putConsent(candidate, "{\"consent\":true}", 200);

        assertThat(jdbc.queryForObject("SELECT recruiter_visibility_consent_at FROM candidates WHERE id = ?",
                Timestamp.class, candidate)).isEqualTo(first);
        // Retirer ce qui n'a jamais été accordé : 200, toujours absent.
        UUID never = data.candidateWithoutConsent(null);
        putConsent(never, "{\"consent\":false}", 200);
        mockMvc.perform(get(VISIBILITY).with(as(never))).andExpect(jsonPath("$.consented").value(false));
    }

    @Test
    void theConsentIsNotAProfileModificationSoTheDirtyFlagStaysUntouched() throws Exception {
        UUID candidate = data.candidateWithoutConsent(null);
        Timestamp before = updatedAt(candidate);

        putConsent(candidate, "{\"consent\":true}", 200);
        putConsent(candidate, "{\"consent\":false}", 200);

        assertThat(updatedAt(candidate)).isEqualTo(before);
    }

    @Test
    void withoutAProfileRowTheConsentIsRefusedWithAReadableConflict() throws Exception {
        UUID noProfile = data.loneRecruiter();

        mockMvc.perform(put(VISIBILITY).with(as(noProfile)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"consent\":true}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(
                        "Add some information to your profile before sharing it with recruiters."));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM candidates WHERE id = ?", Integer.class, noProfile))
                .isZero();
    }

    @Test
    void anInvalidBodyIsABadRequest() throws Exception {
        UUID candidate = data.candidateWithoutConsent(null);

        putConsent(candidate, "{}", 400);
        putConsent(candidate, "{\"consent\":null}", 400);
        putConsent(candidate, "{\"consent\":\"yes\"}", 400);
        putConsent(candidate, "", 400);
        mockMvc.perform(get(VISIBILITY).with(as(candidate))).andExpect(jsonPath("$.consented").value(false));
    }

    @Test
    void bothEndpointsRequireAToken() throws Exception {
        mockMvc.perform(get(VISIBILITY)).andExpect(status().isUnauthorized());
        mockMvc.perform(put(VISIBILITY).contentType(MediaType.APPLICATION_JSON).content("{\"consent\":true}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theSchemaRefusesADateWithoutVersionAndAVersionWithoutDate() {
        UUID candidate = data.candidateWithoutConsent(null);

        assertThatThrownBy(() -> jdbc.update(
                "UPDATE candidates SET recruiter_visibility_consent_at = now() WHERE id = ?", candidate))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update(
                "UPDATE candidates SET recruiter_visibility_consent_version = 1 WHERE id = ?", candidate))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("""
                UPDATE candidates SET recruiter_visibility_consent_at = now(), recruiter_visibility_consent_version = 0
                WHERE id = ?""", candidate)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
