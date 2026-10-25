package com.linqorbit.invitation.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite OfferCandidateStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class OfferCandidateStatusConverter implements AttributeConverter<OfferCandidateStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(OfferCandidateStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public OfferCandidateStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : OfferCandidateStatus.fromCode(dbData);
    }
}
