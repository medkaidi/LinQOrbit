package com.linqorbit.candidate.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite NormalizationJobStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class NormalizationJobStatusConverter implements AttributeConverter<NormalizationJobStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(NormalizationJobStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public NormalizationJobStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : NormalizationJobStatus.fromCode(dbData);
    }
}
