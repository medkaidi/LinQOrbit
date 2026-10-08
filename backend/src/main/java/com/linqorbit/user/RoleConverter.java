package com.linqorbit.user;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite Role ↔ SMALLINT (jamais @Enumerated(ORDINAL) : l'ordre
 * des constantes n'est pas un contrat). Miroir de {@link UserStatusConverter}.
 */
@Converter(autoApply = false)
public class RoleConverter implements AttributeConverter<Role, Short> {

    @Override
    public Short convertToDatabaseColumn(Role attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public Role convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : Role.fromCode(dbData);
    }
}
