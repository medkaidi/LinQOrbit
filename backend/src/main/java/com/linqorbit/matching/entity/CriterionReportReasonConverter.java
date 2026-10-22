package com.linqorbit.matching.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite CriterionReportReason ↔ SMALLINT (jamais
 * {@code @Enumerated(ORDINAL)}).
 */
@Converter(autoApply = false)
public class CriterionReportReasonConverter implements AttributeConverter<CriterionReportReason, Short> {

    @Override
    public Short convertToDatabaseColumn(CriterionReportReason attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public CriterionReportReason convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : CriterionReportReason.fromCode(dbData);
    }
}
