package com.linqorbit.candidate.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite LinkType ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class LinkTypeConverter implements AttributeConverter<LinkType, Short> {

    @Override
    public Short convertToDatabaseColumn(LinkType attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public LinkType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : LinkType.fromCode(dbData);
    }
}
