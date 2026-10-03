package com.linqorbit.candidate;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite SkillType ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class SkillTypeConverter implements AttributeConverter<SkillType, Short> {

    @Override
    public Short convertToDatabaseColumn(SkillType attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public SkillType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : SkillType.fromCode(dbData);
    }
}
