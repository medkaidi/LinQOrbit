package com.linqorbit.user;

import lombok.Getter;

/**
 * Rôle de capacité d'un compte (RBAC minimal) : stocké en SMALLINT
 * ({@code user_roles.role}). Le mapping vers le code est explicite : jamais basé
 * sur l'ordre de déclaration. L'identité candidat/recruteur n'est PAS un rôle :
 * elle vit dans les tables {@code candidates}/{@code recruiters} — voir AGENTS.
 */
@Getter
public enum Role {

    ADMIN(1);

    private final int code;

    Role(int code) {
        this.code = code;
    }

    public static Role fromCode(short code) {
        for (Role value : values()) {
            if (value.code == code) {
                return value;
            }
        }
        throw new IllegalArgumentException("Code de rôle inconnu : " + code);
    }
}
