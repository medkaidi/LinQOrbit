package com.linqorbit.matching.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite MatchingJobStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class MatchingJobStatusConverter implements AttributeConverter<MatchingJobStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(MatchingJobStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public MatchingJobStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : MatchingJobStatus.fromCode(dbData);
    }
}
