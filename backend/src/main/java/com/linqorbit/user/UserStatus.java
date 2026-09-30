package com.linqorbit.user;

/**
 * Statut d'un compte utilisateur, stocké en SMALLINT (colonne users.status).
 * Le mapping vers le code est explicite : jamais basé sur l'ordre de déclaration.
 */
public enum UserStatus {

    ACTIVE(1),
    INACTIVE(2),
    SUSPENDED(3);

    private final int code;

    UserStatus(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }

    public static UserStatus fromCode(short code) {
        for (UserStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut inconnu : " + code);
    }
}
