package com.linqorbit.joboffer.entity;

import lombok.Getter;

/**
 * Type d'exigence d'une compétence d'offre (D12), stocké en SMALLINT
 * (job_offer_skill.requirement_type) : obligatoire ou souhaitable — la
 * distinction coarse des critères §7 avant le moteur de matching.
 */
@Getter
public enum RequirementType {

    MANDATORY(1, "mandatory"),
    PREFERRED(2, "preferred");

    private final int code;
    private final String apiValue;

    RequirementType(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static RequirementType fromCode(short code) {
        for (RequirementType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        throw new IllegalArgumentException("Code de type d'exigence inconnu : " + code);
    }

    public static RequirementType fromApiValue(String value) {
        for (RequirementType type : values()) {
            if (type.apiValue.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Valeur de type d'exigence inconnue : " + value);
    }
}
