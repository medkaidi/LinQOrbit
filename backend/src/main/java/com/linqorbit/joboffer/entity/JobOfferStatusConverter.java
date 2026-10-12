package com.linqorbit.joboffer.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite JobOfferStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class JobOfferStatusConverter implements AttributeConverter<JobOfferStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(JobOfferStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public JobOfferStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : JobOfferStatus.fromCode(dbData);
    }
}
