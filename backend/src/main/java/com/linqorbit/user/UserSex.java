package com.linqorbit.user;

/**
 * Sexe du compte, stocké en SMALLINT (colonne users.sex).
 * Code et valeur API sont déclarés ensemble pour qu'aucun des deux mappings
 * (base et JSON) ne dépende de l'ordre des constantes.
 */
public enum UserSex {

    MALE(1, "male"),
    FEMALE(2, "female"),
    OTHER(3, "other");

    private final int code;
    private final String apiValue;

    UserSex(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public int getCode() {
        return code;
    }

    public String getApiValue() {
        return apiValue;
    }

    public static UserSex fromCode(short code) {
        for (UserSex sex : values()) {
            if (sex.code == code) {
                return sex;
            }
        }
        throw new IllegalArgumentException("Code sexe inconnu : " + code);
    }

    public static UserSex fromApiValue(String value) {
        for (UserSex sex : values()) {
            if (sex.apiValue.equals(value)) {
                return sex;
            }
        }
        throw new IllegalArgumentException("Valeur sexe inconnue : " + value);
    }
}
