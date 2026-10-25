package com.linqorbit.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;

/**
 * Garanties que porte la base elle-même (V28), indépendamment du code Java :
 * dimension du vecteur, statuts valides, unicité par couple, clés étrangères,
 * conservation des anciens vecteurs, sémantique de la distance cosinus.
 */
class EmbeddingSchemaIntegrationTest extends EmbeddingIntegrationTestSupport {

    private static final String CONTENT = "{\"schemaVersion\":\"3\",\"title\":\"Backend Engineer\"}";

    private EmbeddingTestData data;

    @BeforeEach
    void setUp() {
        data = new EmbeddingTestData(jdbc);
        data.cleanupTestModelRows();
    }

    @AfterEach
    void cleanup() {
        data.cleanup();
    }

    private UUID fiche() {
        return data.candidateFiche(data.candidate(null), 1, CONTENT);
    }

    private void insertEmbedding(UUID profileId, String literal, String model, String strategy) {
        jdbc.update("""
                INSERT INTO profile_embedding
                    (id, normalized_profile_id, embedding, model_name, model_version, strategy_version, created_at)
                VALUES (?, ?, CAST(? AS vector), ?, '1', ?, now())""",
                UUID.randomUUID(), profileId, literal, model, strategy);
    }

    private void insertJob(UUID profileId, int status, int attempts, String model, String strategy) {
        jdbc.update("""
                INSERT INTO embedding_job (job_id, normalized_profile_id, model_name, model_version,
                                           strategy_version, status, attempts, next_attempt_at, created_at)
                VALUES (?, ?, ?, '1', ?, ?, ?, now(), now())""",
                UUID.randomUUID(), profileId, model, strategy, status, attempts);
    }

    private double cosineDistance(String a, String b) {
        return jdbc.queryForObject("SELECT CAST(? AS vector) <=> CAST(? AS vector)", Double.class, a, b);
    }

    // --- extension et dimension ---------------------------------------------------

    @Test
    void thePgvectorExtensionIsInstalled() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_extension WHERE extname = 'vector'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void aVectorOfAnotherDimensionIsRefusedByTheColumn() {
        UUID profileId = fiche();

        assertThatThrownBy(() -> insertEmbedding(profileId, "[1,2,3]", EmbeddingTestData.TEST_MODEL, "text-1"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(1f).replace("]", ",0]"),
                EmbeddingTestData.TEST_MODEL, "text-1")).isInstanceOf(DataAccessException.class);
    }

    @Test
    void aVectorWithANonFiniteValueIsRefusedByThePgvectorType() {
        UUID profileId = fiche();
        String withNaN = EmbeddingTestData.vectorLiteral(1f).replaceFirst("1\\.0", "NaN");

        assertThatThrownBy(() -> insertEmbedding(profileId, withNaN, EmbeddingTestData.TEST_MODEL, "text-1"))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void aMissingVectorIsRefused() {
        UUID profileId = fiche();

        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO profile_embedding
                    (id, normalized_profile_id, embedding, model_name, model_version, strategy_version, created_at)
                VALUES (?, ?, NULL, 'm', '1', 'text-1', now())""", UUID.randomUUID(), profileId))
                .isInstanceOf(DataAccessException.class);
    }

    // --- unicité et conservation ----------------------------------------------------

    @Test
    void theSameFicheModelVersionAndStrategyCannotBeVectorizedTwice() {
        UUID profileId = fiche();
        insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(1f), EmbeddingTestData.TEST_MODEL, "text-1");

        assertThatThrownBy(() -> insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(2f),
                EmbeddingTestData.TEST_MODEL, "text-1")).isInstanceOf(DataAccessException.class);
    }

    @Test
    void anotherModelOrAnotherStrategyAddsALineAndKeepsTheOldVector() {
        UUID profileId = fiche();
        insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(1f), EmbeddingTestData.TEST_MODEL, "text-1");

        insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(1f), EmbeddingTestData.TEST_MODEL, "text-2");
        insertEmbedding(profileId, EmbeddingTestData.vectorLiteral(1f), "another-model", "text-1");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM profile_embedding WHERE normalized_profile_id = ?",
                Integer.class, profileId)).isEqualTo(3);
    }

    @Test
    void aSingleJobExistsPerFicheModelVersionAndStrategy() {
        UUID profileId = fiche();
        insertJob(profileId, 1, 0, EmbeddingTestData.TEST_MODEL, "text-1");

        assertThatThrownBy(() -> insertJob(profileId, 1, 0, EmbeddingTestData.TEST_MODEL, "text-1"))
                .isInstanceOf(DataAccessException.class);
        insertJob(profileId, 1, 0, EmbeddingTestData.TEST_MODEL, "text-2");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM embedding_job WHERE normalized_profile_id = ?",
                Integer.class, profileId)).isEqualTo(2);
    }

    // --- statuts, tentatives, tailles ---------------------------------------------------

    @Test
    void onlyTheFiveStatusCodesAreAccepted() {
        UUID profileId = fiche();

        for (int valid = 1; valid <= 5; valid++) {
            insertJob(profileId, valid, 0, EmbeddingTestData.TEST_MODEL, "text-" + valid);
        }

        assertThatThrownBy(() -> insertJob(profileId, 0, 0, EmbeddingTestData.TEST_MODEL, "text-0"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> insertJob(profileId, 6, 0, EmbeddingTestData.TEST_MODEL, "text-6"))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void aNegativeAttemptCountIsRefused() {
        UUID profileId = fiche();

        assertThatThrownBy(() -> insertJob(profileId, 1, -1, EmbeddingTestData.TEST_MODEL, "text-1"))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void anErrorLongerThanFiveHundredCharactersIsRefusedByTheColumn() {
        UUID profileId = fiche();
        insertJob(profileId, 1, 0, EmbeddingTestData.TEST_MODEL, "text-1");

        assertThatThrownBy(() -> jdbc.update("UPDATE embedding_job SET error = ? WHERE normalized_profile_id = ?",
                "e".repeat(501), profileId)).isInstanceOf(DataAccessException.class);
        jdbc.update("UPDATE embedding_job SET error = ? WHERE normalized_profile_id = ?", "e".repeat(500), profileId);
    }

    // --- clés étrangères ---------------------------------------------------------------

    @Test
    void aJobOrAVectorForAnUnknownFicheIsRefused() {
        UUID unknown = UUID.randomUUID();

        assertThatThrownBy(() -> insertJob(unknown, 1, 0, EmbeddingTestData.TEST_MODEL, "text-1"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> insertEmbedding(unknown, EmbeddingTestData.vectorLiteral(1f),
                EmbeddingTestData.TEST_MODEL, "text-1")).isInstanceOf(DataAccessException.class);
    }

    @Test
    void aFicheThatHasAVectorOrAJobCannotBeDeleted() {
        UUID withVector = fiche();
        insertEmbedding(withVector, EmbeddingTestData.vectorLiteral(1f), EmbeddingTestData.TEST_MODEL, "text-1");
        UUID withJob = fiche();
        insertJob(withJob, 1, 0, EmbeddingTestData.TEST_MODEL, "text-1");

        // Le lien candidat est levé pour que seule la clé étrangère de l'embedding / du job bloque la suppression.
        jdbc.update("DELETE FROM normalized_profile_candidate WHERE normalized_profile_id IN (?, ?)", withVector,
                withJob);

        // Les vecteurs et les traces sont conservés : on ne supprime jamais une fiche qui en porte.
        assertThatThrownBy(() -> jdbc.update("DELETE FROM normalized_profile WHERE normalized_profile_id = ?",
                withVector)).isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("DELETE FROM normalized_profile WHERE normalized_profile_id = ?",
                withJob)).isInstanceOf(DataAccessException.class);
    }

    // --- sémantique de la distance cosinus ---------------------------------------------

    @Test
    void theCosineDistanceIsZeroForIdenticalOneForOrthogonalTwoForOppositeVectors() {
        String e1 = EmbeddingTestData.vectorLiteral(1f);
        String e2 = EmbeddingTestData.vectorLiteral(0f, 1f);
        String minusE1 = EmbeddingTestData.vectorLiteral(-1f);

        assertThat(cosineDistance(e1, e1)).isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(cosineDistance(e1, e2)).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(cosineDistance(e1, minusE1)).isCloseTo(2.0, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void theCosineDistanceIgnoresTheMagnitudeOfTheVectors() {
        String small = EmbeddingTestData.vectorLiteral(1f, 1f);
        String large = EmbeddingTestData.vectorLiteral(100f, 100f);

        assertThat(cosineDistance(small, large)).isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-6));
    }
}
