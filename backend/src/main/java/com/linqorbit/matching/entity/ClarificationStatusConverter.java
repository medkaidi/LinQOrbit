package com.linqorbit.matching.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite ClarificationStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class ClarificationStatusConverter implements AttributeConverter<ClarificationStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(ClarificationStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public ClarificationStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ClarificationStatus.fromCode(dbData);
    }
}
