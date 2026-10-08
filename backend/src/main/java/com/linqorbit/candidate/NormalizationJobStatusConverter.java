package com.linqorbit.candidate;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite NormalizationJobStatus ↔ VARCHAR (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class NormalizationJobStatusConverter implements AttributeConverter<NormalizationJobStatus, String> {

    @Override
    public String convertToDatabaseColumn(NormalizationJobStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public NormalizationJobStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : NormalizationJobStatus.valueOf(dbData);
    }
}
