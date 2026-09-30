package com.linqorbit.user;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite UserStatus ↔ SMALLINT (jamais @Enumerated(ORDINAL) : l'ordre
 * des constantes n'est pas un contrat).
 */
@Converter(autoApply = false)
public class UserStatusConverter implements AttributeConverter<UserStatus, Short> {

    @Override
    public Short convertToDatabaseColumn(UserStatus attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public UserStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : UserStatus.fromCode(dbData);
    }
}
