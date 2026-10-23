package com.linqorbit.matching.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite CriterionReportReviewVerdict ↔ SMALLINT (jamais
 * {@code @Enumerated(ORDINAL)}).
 */
@Converter(autoApply = false)
public class CriterionReportReviewVerdictConverter
        implements AttributeConverter<CriterionReportReviewVerdict, Short> {

    @Override
    public Short convertToDatabaseColumn(CriterionReportReviewVerdict attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public CriterionReportReviewVerdict convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : CriterionReportReviewVerdict.fromCode(dbData);
    }
}
