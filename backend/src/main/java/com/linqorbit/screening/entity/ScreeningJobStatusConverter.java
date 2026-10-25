package com.linqorbit.screening.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite ScreeningJobStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class ScreeningJobStatusConverter implements AttributeConverter<ScreeningJobStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(ScreeningJobStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public ScreeningJobStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ScreeningJobStatus.fromCode(dbData);
    }
}
