package com.linqorbit.embedding.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite EmbeddingJobStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class EmbeddingJobStatusConverter implements AttributeConverter<EmbeddingJobStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(EmbeddingJobStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public EmbeddingJobStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : EmbeddingJobStatus.fromCode(dbData);
    }
}
