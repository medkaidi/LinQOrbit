package com.linqorbit.candidate;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite SearchStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class SearchStatusConverter implements AttributeConverter<SearchStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(SearchStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public SearchStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : SearchStatus.fromCode(dbData);
    }
}
