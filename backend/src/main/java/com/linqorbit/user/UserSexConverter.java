package com.linqorbit.user;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Mapping explicite UserSex ↔ SMALLINT (jamais @Enumerated(ORDINAL)).
 */
@Converter(autoApply = false)
public class UserSexConverter implements AttributeConverter<UserSex, Short> {

    @Override
    public Short convertToDatabaseColumn(UserSex attribute) {
        return attribute == null ? null : (short) attribute.getCode();
    }

    @Override
    public UserSex convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : UserSex.fromCode(dbData);
    }
}
