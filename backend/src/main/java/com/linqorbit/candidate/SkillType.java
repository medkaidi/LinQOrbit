package com.linqorbit.candidate;

import lombok.Getter;

/**
 * Type de compétence, stocké en SMALLINT (colonne skills.skill_type).
 * Code et valeur API sont déclarés ensemble pour qu'aucun des deux mappings
 * (base et JSON) ne dépende de l'ordre des constantes.
 */
@Getter
public enum SkillType {

    TECH(1, "tech"),
    SOFT(2, "soft");

    private final int code;
    private final String apiValue;

    SkillType(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static SkillType fromCode(short code) {
        for (SkillType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        throw new IllegalArgumentException("Code de type de compétence inconnu : " + code);
    }
}
