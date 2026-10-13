package com.linqorbit.candidate.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite NormalizationSourceType ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class NormalizationSourceTypeConverter
        implements AttributeConverter<NormalizationSourceType, Short> {

    @Override
    public Short convertToDatabaseColumn(NormalizationSourceType attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public NormalizationSourceType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : NormalizationSourceType.fromCode(dbData);
    }
}
