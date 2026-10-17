package com.linqorbit.application.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite ApplicationStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class ApplicationStatusConverter implements AttributeConverter<ApplicationStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(ApplicationStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public ApplicationStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ApplicationStatus.fromCode(dbData);
    }
}
