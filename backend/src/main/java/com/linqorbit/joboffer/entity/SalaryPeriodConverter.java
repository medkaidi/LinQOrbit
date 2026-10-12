package com.linqorbit.joboffer.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite SalaryPeriod ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class SalaryPeriodConverter implements AttributeConverter<SalaryPeriod, Short> {

    @Override
    public Short convertToDatabaseColumn(SalaryPeriod attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public SalaryPeriod convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : SalaryPeriod.fromCode(dbData);
    }
}
