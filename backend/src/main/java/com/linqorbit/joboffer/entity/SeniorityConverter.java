package com.linqorbit.joboffer.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite Seniority ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class SeniorityConverter implements AttributeConverter<Seniority, Short> {

    @Override
    public Short convertToDatabaseColumn(Seniority attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public Seniority convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : Seniority.fromCode(dbData);
    }
}
