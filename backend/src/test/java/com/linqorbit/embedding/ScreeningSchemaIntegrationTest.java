package com.linqorbit.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Contraintes de la migration V29 (T-101) sur PostgreSQL réel : ce que la base
 * garantit seule, indépendamment du code applicatif — un job par fiche
 * d'offre, une ligne par couple (offre, candidat), statut et cohérence
 * « invité par / le », rang, compte, clés étrangères et cascades.
 */
class ScreeningSchemaIntegrationTest extends EmbeddingIntegrationTestSupport {

    private EmbeddingTestData data;
    private EmbeddingTestData.OfferFixture offer;
    private UUID offerFiche;
    private UUID jobId;
    private UUID candidateId;
    private UUID candidateFiche;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        offer = data.publishedOffer();
        offerFiche = data.offerFiche(offer.offerId(), 1, "{\"schemaVersion\":\"2\"}");
        candidateId = data.candidate(null);
        candidateFiche = data.candidateFiche(candidateId, 1, "{\"schemaVersion\":\"3\"}");
        jobId = UUID.randomUUID();
        job(jobId, offer.offerId(), offerFiche, 1, 0, null);
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private void job(UUID id, UUID offerId, UUID profileId, int status, int attempts, Integer count) {
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at)
                VALUES (?, ?, ?, ?, ?, now(), ?, now())""", id, offerId, profileId, status, attempts, count);
    }

    private void row(UUID id, UUID offerId, UUID candidate, UUID fiche, UUID screeningJob, int rank, int status,
            UUID invitedBy) {
        jdbc.update("""
                INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                             screening_job_id, rank, distance, status, invited_by_user_id,
                                             invited_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0.5, ?, ?, CASE WHEN CAST(? AS uuid) IS NULL THEN NULL ELSE now() END, now())""",
                id, offerId, candidate, fiche, screeningJob, rank, status, invitedBy, invitedBy);
    }

    private void suggested(UUID id) {
        row(id, offer.offerId(), candidateId, candidateFiche, jobId, 1, 1, null);
    }

    // --- screening_job ---------------------------------------------------------------

    @Test
    void aFicheHasAtMostOneScreeningJob() {
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), offerFiche, 1, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void theJobStatusMustBeOneOfTheFiveStates() {
        UUID other = data.offerFiche(offer.offerId(), 2, "{\"schemaVersion\":\"2\"}");
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), other, 0, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), other, 6, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void attemptsAndCountCannotBeNegativeButAZeroCountIsValid() {
        UUID other = data.offerFiche(offer.offerId(), 2, "{\"schemaVersion\":\"2\"}");
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), other, 1, -1, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), other, 3, 1, -1))
                .isInstanceOf(DataIntegrityViolationException.class);

        job(UUID.randomUUID(), offer.offerId(), other, 3, 1, 0);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM screening_job WHERE job_offer_id = ?", Integer.class,
                offer.offerId())).isEqualTo(2);
    }

    @Test
    void aJobNeedsAnExistingOfferAndFiche() {
        assertThatThrownBy(() -> job(UUID.randomUUID(), UUID.randomUUID(), offerFiche, 1, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> job(UUID.randomUUID(), offer.offerId(), UUID.randomUUID(), 1, 0, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // --- offer_candidate ---------------------------------------------------------------

    @Test
    void aCandidateIsSuggestedAtMostOncePerOffer() {
        suggested(UUID.randomUUID());

        assertThatThrownBy(() -> suggested(UUID.randomUUID())).isInstanceOf(DataIntegrityViolationException.class);

        OfferFixtureAndJob other = anotherOffer();
        row(UUID.randomUUID(), other.offerId(), candidateId, candidateFiche, other.jobId(), 1, 1, null);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM offer_candidate WHERE candidate_id = ?",
                Integer.class, candidateId)).isEqualTo(2);
    }

    @Test
    void theStatusAndTheInvitationFieldsMustAgree() {
        UUID id = UUID.randomUUID();
        // SUGGESTED avec un invitant, INVITED sans invitant, statut hors bornes : refusés.
        assertThatThrownBy(() -> row(id, offer.offerId(), candidateId, candidateFiche, jobId, 1, 1,
                offer.creatorId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(id, offer.offerId(), candidateId, candidateFiche, jobId, 1, 2, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(id, offer.offerId(), candidateId, candidateFiche, jobId, 1, 3, null))
                .isInstanceOf(DataIntegrityViolationException.class);

        row(id, offer.offerId(), candidateId, candidateFiche, jobId, 1, 2, offer.creatorId());

        assertThat(jdbc.queryForObject("SELECT status FROM offer_candidate WHERE id = ?", Integer.class, id))
                .isEqualTo(2);
    }

    @Test
    void theRankStartsAtOne() {
        assertThatThrownBy(() -> row(UUID.randomUUID(), offer.offerId(), candidateId, candidateFiche, jobId, 0, 1,
                null)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void everyReferenceMustExist() {
        assertThatThrownBy(() -> row(UUID.randomUUID(), UUID.randomUUID(), candidateId, candidateFiche, jobId, 1, 1,
                null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(UUID.randomUUID(), offer.offerId(), UUID.randomUUID(), candidateFiche, jobId,
                1, 1, null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(UUID.randomUUID(), offer.offerId(), candidateId, UUID.randomUUID(), jobId, 1,
                1, null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(UUID.randomUUID(), offer.offerId(), candidateId, candidateFiche,
                UUID.randomUUID(), 1, 1, null)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> row(UUID.randomUUID(), offer.offerId(), candidateId, candidateFiche, jobId, 1, 2,
                UUID.randomUUID())).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingTheScreeningJobRemovesItsSuggestions() {
        UUID id = UUID.randomUUID();
        suggested(id);

        jdbc.update("DELETE FROM screening_job WHERE job_id = ?", jobId);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM offer_candidate WHERE id = ?", Integer.class, id))
                .isZero();
    }

    private record OfferFixtureAndJob(UUID offerId, UUID jobId) {
    }

    private OfferFixtureAndJob anotherOffer() {
        EmbeddingTestData.OfferFixture other = data.publishedOffer();
        UUID fiche = data.offerFiche(other.offerId(), 1, "{\"schemaVersion\":\"2\"}");
        UUID otherJob = UUID.randomUUID();
        job(otherJob, other.offerId(), fiche, 1, 0, null);
        return new OfferFixtureAndJob(other.offerId(), otherJob);
    }
}
