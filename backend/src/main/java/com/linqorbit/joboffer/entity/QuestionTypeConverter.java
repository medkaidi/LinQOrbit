package com.linqorbit.joboffer.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite QuestionType ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class QuestionTypeConverter implements AttributeConverter<QuestionType, Short> {

    @Override
    public Short convertToDatabaseColumn(QuestionType attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public QuestionType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : QuestionType.fromCode(dbData);
    }
}
