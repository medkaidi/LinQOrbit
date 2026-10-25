package com.linqorbit.embedding.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Les codes SMALLINT du statut sont un contrat avec la base (CHECK 1..5 de
 * V28, requêtes natives) : ils ne doivent jamais dériver de l'ordre de l'enum.
 */
class EmbeddingJobStatusTest {

    private final EmbeddingJobStatusConverter converter = new EmbeddingJobStatusConverter();

    @Test
    void theCodesAreThoseOfTheMigration() {
        assertThat(EmbeddingJobStatus.PENDING.getCode()).isEqualTo(1);
        assertThat(EmbeddingJobStatus.RUNNING.getCode()).isEqualTo(2);
        assertThat(EmbeddingJobStatus.DONE.getCode()).isEqualTo(3);
        assertThat(EmbeddingJobStatus.FAILED.getCode()).isEqualTo(4);
        assertThat(EmbeddingJobStatus.SUPERSEDED.getCode()).isEqualTo(5);
    }

    @Test
    void everyStatusSurvivesAColumnRoundTrip() {
        for (EmbeddingJobStatus status : EmbeddingJobStatus.values()) {
            Short column = converter.convertToDatabaseColumn(status);
            assertThat(converter.convertToEntityAttribute(column)).isEqualTo(status);
        }
    }

    @Test
    void aNullStaysNullBothWays() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void anUnknownCodeIsRejectedInsteadOfBeingGuessed() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute((short) 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> EmbeddingJobStatus.fromCode((short) 6))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
