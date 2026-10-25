package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.linqorbit.embedding.EmbeddingIntegrationTestSupport;
import com.linqorbit.embedding.EmbeddingTestData;
import com.linqorbit.screening.dto.ScreenedCandidate;

/**
 * Top N pgvector sur PostgreSQL réel (T-65, D55) : la jointure stricte (dernière
 * fiche avec contenu + modèle/stratégie actifs) rend un vecteur périmé
 * inatteignable, sans filtre applicatif. Vecteurs contrôlés à deux
 * dimensions utiles ; modèle de test dédié, donc seuls les candidats créés ici
 * peuvent apparaître.
 */
class ScreeningIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CANDIDATE_CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Engineer\"}";
    private static final String OFFER_CONTENT = "{\"schemaVersion\":\"2\",\"title\":\"Developer\"}";

    @Autowired
    private ScreeningService screeningService;

    private EmbeddingTestData data;
    private UUID offerId;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
        offerId = data.offer();
        // Fiche d'offre courante, vecteur (1, 0) : « la direction recherchée ».
        data.embedding(data.offerFiche(offerId, 1, OFFER_CONTENT), 1f, 0f);
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    /** Candidat avec une fiche courante vectorisée sur le couple actif. */
    private UUID candidateAt(Integer searchStatus, float... vector) {
        UUID candidateId = data.candidate(searchStatus);
        data.embedding(data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT), vector);
        return candidateId;
    }

    private static List<UUID> ids(List<ScreenedCandidate> top) {
        return top.stream().map(ScreenedCandidate::candidateId).toList();
    }

    // --- nominal ----------------------------------------------------------------

    @Test
    void candidatesComeBackByAscendingCosineDistance() {
        UUID far = candidateAt(null, 0f, 1f);
        UUID near = candidateAt(null, 1f, 0.1f);
        UUID opposite = candidateAt(null, -1f, 0f);
        UUID mid = candidateAt(null, 1f, 1f);

        List<ScreenedCandidate> top = screeningService.topCandidates(offerId, 10);

        assertThat(ids(top)).containsExactly(near, mid, far, opposite);
        assertThat(top.get(0).distance()).isCloseTo(1 - 1 / Math.sqrt(1.01), within(1e-4));
        assertThat(top.get(1).distance()).isCloseTo(1 - 1 / Math.sqrt(2), within(1e-4));
        assertThat(top.get(2).distance()).isCloseTo(1.0, within(1e-4));
        assertThat(top.get(3).distance()).isCloseTo(2.0, within(1e-4));
    }

    @Test
    void theResultCarriesTheFicheThatWasCompared() {
        UUID candidateId = data.candidate(null);
        UUID fiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.embedding(fiche, 1f, 0f);

        List<ScreenedCandidate> top = screeningService.topCandidates(offerId, 5);

        assertThat(top).singleElement().satisfies(match -> {
            assertThat(match.candidateId()).isEqualTo(candidateId);
            assertThat(match.normalizedProfileId()).isEqualTo(fiche);
            assertThat(match.distance()).isCloseTo(0.0, within(1e-6));
        });
    }

    @Test
    void theOrderIsDeterministicWhenDistancesTie() {
        List<UUID> twins = new ArrayList<>(List.of(candidateAt(null, 1f, 1f), candidateAt(null, 1f, 1f),
                candidateAt(null, 1f, 1f)));

        List<UUID> ordered = ids(screeningService.topCandidates(offerId, 10));

        // PostgreSQL compare les uuid octet par octet (non signé) : l'ordre du texte hexadécimal,
        // pas UUID.compareTo de Java (qui compare des longs signés).
        twins.sort(Comparator.comparing(UUID::toString));
        assertThat(ordered).containsExactlyElementsOf(twins);
    }

    // --- bornes de N --------------------------------------------------------------

    @Test
    void nCutsTheListAndKeepsTheClosest() {
        UUID near = candidateAt(null, 1f, 0.1f);
        UUID mid = candidateAt(null, 1f, 1f);
        candidateAt(null, 0f, 1f);

        assertThat(ids(screeningService.topCandidates(offerId, 1))).containsExactly(near);
        assertThat(ids(screeningService.topCandidates(offerId, 2))).containsExactly(near, mid);
    }

    @Test
    void aNLargerThanThePopulationReturnsEveryone() {
        candidateAt(null, 1f, 0f);
        candidateAt(null, 0f, 1f);

        assertThat(screeningService.topCandidates(offerId, 50)).hasSize(2);
        assertThat(screeningService.topCandidates(offerId, ScreeningService.MAX_TOP_N + 1_000)).hasSize(2);
    }

    @Test
    void aNOfZeroIsEmptyAndANegativeNIsRejected() {
        candidateAt(null, 1f, 0f);

        assertThat(screeningService.topCandidates(offerId, 0)).isEmpty();
        assertThatThrownBy(() -> screeningService.topCandidates(offerId, -1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theConfiguredNIsUsedWhenNoneIsGiven() {
        for (int i = 0; i < 22; i++) {
            candidateAt(null, 1f, i / 100f);
        }

        // app.screening.top-n = 10 par défaut.
        assertThat(screeningService.topCandidates(offerId)).hasSize(10);
    }

    // --- jamais de vecteur périmé -----------------------------------------------

    @Test
    void anOlderFicheOfACandidateIsNeverCaught() {
        UUID candidateId = data.candidate(null);
        UUID oldFiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        UUID currentFiche = data.candidateFiche(candidateId, 2, CANDIDATE_CONTENT);
        data.embedding(oldFiche, 1f, 0f);   // la vieille fiche est « parfaite »…
        data.embedding(currentFiche, 0f, 1f); // …la courante est orthogonale

        List<ScreenedCandidate> top = screeningService.topCandidates(offerId, 10);

        assertThat(top).singleElement().satisfies(match -> {
            assertThat(match.normalizedProfileId()).isEqualTo(currentFiche);
            assertThat(match.distance()).isCloseTo(1.0, within(1e-4));
        });
    }

    @Test
    void aCandidateWhoseTwoFichesShareTheLatestVersionAppearsOnlyOnce() {
        // Aucune contrainte UNIQUE(candidat, version) en base (V9) : des doublons existent réellement.
        UUID candidateId = data.candidate(null);
        UUID closer = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        UUID farther = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.embedding(closer, 1f, 0.1f);
        data.embedding(farther, 0f, 1f);
        UUID other = candidateAt(null, 1f, 1f);

        List<ScreenedCandidate> top = screeningService.topCandidates(offerId, 10);

        assertThat(ids(top)).containsExactly(candidateId, other);
        assertThat(top.get(0).normalizedProfileId()).isEqualTo(closer);
    }

    @Test
    void anOfferWhoseTwoFichesShareTheLatestVersionDoesNotDuplicateTheCandidates() {
        UUID horizontal = candidateAt(null, 1f, 0f);
        UUID vertical = candidateAt(null, 0f, 1f);
        UUID duplicated = data.offer();
        data.embedding(data.offerFiche(duplicated, 1, OFFER_CONTENT), 1f, 0f);
        data.embedding(data.offerFiche(duplicated, 1, OFFER_CONTENT), 0f, 1f);

        List<UUID> top = ids(screeningService.topCandidates(duplicated, 10));

        assertThat(top).containsExactlyInAnyOrder(horizontal, vertical).doesNotHaveDuplicates();
    }

    @Test
    void aNewerFicheStillAnalysingDoesNotHideTheCurrentOne() {
        UUID candidateId = data.candidate(null);
        UUID current = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.candidateFiche(candidateId, 2, null);
        data.embedding(current, 1f, 0f);

        assertThat(screeningService.topCandidates(offerId, 10)).singleElement()
                .satisfies(match -> assertThat(match.normalizedProfileId()).isEqualTo(current));
    }

    @Test
    void aVectorOfAnotherModelOrStrategyIsNeverCaught() {
        UUID otherModel = data.candidate(null);
        data.embedding(data.candidateFiche(otherModel, 1, CANDIDATE_CONTENT), "legacy-model",
                EmbeddingTestData.STRATEGY, 1f, 0f);
        UUID otherStrategy = data.candidate(null);
        data.embedding(data.candidateFiche(otherStrategy, 1, CANDIDATE_CONTENT), EmbeddingTestData.TEST_MODEL,
                "text-0", 1f, 0f);
        UUID active = candidateAt(null, 0f, 1f);

        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(active);
    }

    @Test
    void aCandidateWithBothAnOldAndAnActiveVectorIsMeasuredOnTheActiveOne() {
        UUID candidateId = data.candidate(null);
        UUID fiche = data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        data.embedding(fiche, "legacy-model", EmbeddingTestData.STRATEGY, 1f, 0f);
        data.embedding(fiche, 0f, 1f);

        assertThat(screeningService.topCandidates(offerId, 10)).singleElement()
                .satisfies(match -> assertThat(match.distance()).isCloseTo(1.0, within(1e-4)));
    }

    @Test
    void aCandidateWithoutAnyVectorIsAbsent() {
        UUID candidateId = data.candidate(null);
        data.candidateFiche(candidateId, 1, CANDIDATE_CONTENT);
        UUID embedded = candidateAt(null, 1f, 0f);

        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(embedded);
    }

    // --- disponibilité du candidat ---------------------------------------------

    @Test
    void notLookingCandidatesAreExcludedWhileOtherAndUnsetStatusesAreKept() {
        UUID openToWork = candidateAt(1, 1f, 0f);
        UUID selective = candidateAt(2, 1f, 0.1f);
        UUID notLooking = candidateAt(EmbeddingTestData.NOT_LOOKING, 1f, 0f);
        UUID unset = candidateAt(null, 1f, 0.2f);

        List<UUID> top = ids(screeningService.topCandidates(offerId, 10));

        assertThat(top).containsExactlyInAnyOrder(openToWork, selective, unset).doesNotContain(notLooking);
    }

    // --- consentement à la visibilité recruteur (T-102, D86) ----------------------

    @Test
    void aCandidateWithoutConsentIsNeverProposedEvenIfPerfectlyMatching() {
        UUID consented = candidateAt(null, 1f, 0.5f);
        UUID noConsent = data.candidateWithoutConsent(null);
        data.embedding(data.candidateFiche(noConsent, 1, CANDIDATE_CONTENT), 1f, 0f);

        List<UUID> top = ids(screeningService.topCandidates(offerId, 10));

        assertThat(top).containsExactly(consented);
    }

    @Test
    void withdrawingTheConsentRemovesTheCandidateFromTheNextScreeningAndGrantingAddsHim() {
        UUID candidate = candidateAt(null, 1f, 0f);
        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(candidate);

        data.setConsent(candidate, false);
        assertThat(screeningService.topCandidates(offerId, 10)).isEmpty();

        data.setConsent(candidate, true);
        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(candidate);
    }

    @Test
    void theConsentFilterComesBeforeTheLimitSoUnconsentingCandidatesNeverTakeASlot() {
        UUID noConsent = data.candidateWithoutConsent(null);
        data.embedding(data.candidateFiche(noConsent, 1, CANDIDATE_CONTENT), 1f, 0f);
        UUID second = candidateAt(null, 1f, 0.3f);

        assertThat(ids(screeningService.topCandidates(offerId, 1))).containsExactly(second);
    }

    // --- candidats déjà connus de l'offre (T-101) ------------------------------------

    @Test
    void candidatesWhoAlreadyAppliedToThisOfferAreExcludedWhateverTheApplicationStatus() {
        UUID draft = candidateAt(null, 1f, 0f);
        UUID submitted = candidateAt(null, 1f, 0.1f);
        UUID withdrawn = candidateAt(null, 1f, 0.2f);
        UUID free = candidateAt(null, 1f, 0.3f);
        data.application(draft, offerId, 1);
        data.application(submitted, offerId, 2);
        data.application(withdrawn, offerId, 3);

        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(free);
    }

    @Test
    void anApplicationToAnotherOfferDoesNotExcludeTheCandidate() {
        UUID candidate = candidateAt(null, 1f, 0f);
        UUID otherOffer = data.offer();
        data.application(candidate, otherOffer, 2);

        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(candidate);
    }

    @Test
    void candidatesAlreadySuggestedOrInvitedForThisOfferAreExcludedButNotForAnotherOffer() {
        UUID suggested = candidateAt(null, 1f, 0f);
        UUID invited = candidateAt(null, 1f, 0.1f);
        UUID free = candidateAt(null, 1f, 0.2f);
        UUID fiche = jdbc.queryForObject(
                "SELECT normalized_profile_id FROM normalized_profile_candidate WHERE candidate_id = ?", UUID.class,
                suggested);
        UUID jobId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO screening_job (job_id, job_offer_id, offer_normalized_profile_id, status, attempts,
                                           next_attempt_at, candidate_count, created_at, completed_at)
                SELECT ?, ?, normalized_profile_id, 3, 1, now(), 2, now(), now()
                FROM normalized_profile_job_offer WHERE job_offer_id = ?""", jobId, offerId, offerId);
        for (UUID candidate : List.of(suggested, invited)) {
            jdbc.update("""
                    INSERT INTO offer_candidate (id, job_offer_id, candidate_id, candidate_normalized_profile_id,
                                                 screening_job_id, rank, distance, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 1, 0.1, 1, now())""", UUID.randomUUID(), offerId, candidate, fiche, jobId);
        }

        assertThat(ids(screeningService.topCandidates(offerId, 10))).containsExactly(free);

        UUID otherOffer = data.offer();
        data.embedding(data.offerFiche(otherOffer, 1, OFFER_CONTENT), 1f, 0f);
        assertThat(ids(screeningService.topCandidates(otherOffer, 10)))
                .containsExactlyInAnyOrder(suggested, invited, free);
    }

    // --- l'offre ----------------------------------------------------------------

    @Test
    void anOfferWithoutVectorOrWithoutFicheOrUnknownReturnsNothing() {
        candidateAt(null, 1f, 0f);
        UUID noVector = data.offer();
        data.offerFiche(noVector, 1, OFFER_CONTENT);
        UUID noFiche = data.offer();

        assertThat(screeningService.topCandidates(noVector, 10)).isEmpty();
        assertThat(screeningService.topCandidates(noFiche, 10)).isEmpty();
        assertThat(screeningService.topCandidates(UUID.randomUUID(), 10)).isEmpty();
    }

    @Test
    void anOfferVectorOfAnotherModelIsIgnored() {
        candidateAt(null, 1f, 0f);
        UUID legacyOnly = data.offer();
        data.embedding(data.offerFiche(legacyOnly, 1, OFFER_CONTENT), "legacy-model",
                EmbeddingTestData.STRATEGY, 1f, 0f);

        assertThat(screeningService.topCandidates(legacyOnly, 10)).isEmpty();
    }

    @Test
    void theOfferIsComparedThroughItsCurrentFicheOnly() {
        UUID horizontal = candidateAt(null, 1f, 0f);
        UUID vertical = candidateAt(null, 0f, 1f);
        UUID rewritten = data.offer();
        data.embedding(data.offerFiche(rewritten, 1, OFFER_CONTENT), 1f, 0f); // ancienne fiche : « horizontal »
        data.embedding(data.offerFiche(rewritten, 2, OFFER_CONTENT), 0f, 1f); // fiche courante : « vertical »

        assertThat(ids(screeningService.topCandidates(rewritten, 1))).containsExactly(vertical);
        assertThat(ids(screeningService.topCandidates(offerId, 1))).containsExactly(horizontal);
    }

    @Test
    void anOfferWhoseNewFicheIsStillAnalysingKeepsUsingItsCurrentOne() {
        UUID horizontal = candidateAt(null, 1f, 0f);
        candidateAt(null, 0f, 1f);
        UUID reanalysing = data.offer();
        data.embedding(data.offerFiche(reanalysing, 1, OFFER_CONTENT), 1f, 0f);
        data.offerFiche(reanalysing, 2, null);

        assertThat(ids(screeningService.topCandidates(reanalysing, 1))).containsExactly(horizontal);
    }
}
