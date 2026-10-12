package com.linqorbit.joboffer.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite RequirementType ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class RequirementTypeConverter implements AttributeConverter<RequirementType, Short> {

    @Override
    public Short convertToDatabaseColumn(RequirementType attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public RequirementType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : RequirementType.fromCode(dbData);
    }
}
