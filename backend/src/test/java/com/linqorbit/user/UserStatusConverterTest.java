package com.linqorbit.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class UserStatusConverterTest {

    private final UserStatusConverter converter = new UserStatusConverter();

    @Test
    void mappeLesCodesConnusVersLesConstantes() {
        assertThat(converter.convertToEntityAttribute((short) 1)).isEqualTo(UserStatus.ACTIVE);
        assertThat(converter.convertToEntityAttribute((short) 2)).isEqualTo(UserStatus.INACTIVE);
        assertThat(converter.convertToEntityAttribute((short) 3)).isEqualTo(UserStatus.SUSPENDED);
    }

    @Test
    void mappeLesConstantesVersLeursCodes() {
        assertThat(converter.convertToDatabaseColumn(UserStatus.ACTIVE)).isEqualTo((short) 1);
        assertThat(converter.convertToDatabaseColumn(UserStatus.INACTIVE)).isEqualTo((short) 2);
        assertThat(converter.convertToDatabaseColumn(UserStatus.SUSPENDED)).isEqualTo((short) 3);
    }

    @Test
    void gereLesValeursNulles() {
        assertThat(converter.convertToEntityAttribute(null)).isNull();
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
    }

    @Test
    void rejetteUnCodeInconnu() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute((short) 99))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
