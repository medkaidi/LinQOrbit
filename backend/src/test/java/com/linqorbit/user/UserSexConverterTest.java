package com.linqorbit.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class UserSexConverterTest {

    private final UserSexConverter converter = new UserSexConverter();

    @Test
    void mappeLesCodesConnusVersLesConstantes() {
        assertThat(converter.convertToEntityAttribute((short) 1)).isEqualTo(UserSex.MALE);
        assertThat(converter.convertToEntityAttribute((short) 2)).isEqualTo(UserSex.FEMALE);
        assertThat(converter.convertToEntityAttribute((short) 3)).isEqualTo(UserSex.OTHER);
    }

    @Test
    void mappeLesConstantesVersLeursCodes() {
        assertThat(converter.convertToDatabaseColumn(UserSex.MALE)).isEqualTo((short) 1);
        assertThat(converter.convertToDatabaseColumn(UserSex.FEMALE)).isEqualTo((short) 2);
        assertThat(converter.convertToDatabaseColumn(UserSex.OTHER)).isEqualTo((short) 3);
    }

    @Test
    void mappeLesValeursApiDuFrontend() {
        assertThat(UserSex.fromApiValue("male")).isEqualTo(UserSex.MALE);
        assertThat(UserSex.fromApiValue("female")).isEqualTo(UserSex.FEMALE);
        assertThat(UserSex.fromApiValue("other")).isEqualTo(UserSex.OTHER);
        assertThat(UserSex.MALE.getApiValue()).isEqualTo("male");
    }

    @Test
    void gereLesValeursNulles() {
        assertThat(converter.convertToEntityAttribute(null)).isNull();
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
    }

    @Test
    void rejetteUnCodeInconnu() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute((short) 42))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> UserSex.fromApiValue("unknown"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
