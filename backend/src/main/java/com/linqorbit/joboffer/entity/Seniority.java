package com.linqorbit.joboffer.entity;

import lombok.Getter;

/**
 * Séniorité visée par une offre, stockée en SMALLINT (job_offer.seniority).
 * Vocabulaire aligné sur le schema v2 du service IA
 * (junior/mid/senior/lead/principal) — symétrie obligatoire avec la fiche
 * candidat pour le matching (D14).
 */
@Getter
public enum Seniority {

    JUNIOR(1, "junior"),
    MID(2, "mid"),
    SENIOR(3, "senior"),
    LEAD(4, "lead"),
    PRINCIPAL(5, "principal");

    private final int code;
    private final String apiValue;

    Seniority(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static Seniority fromCode(short code) {
        for (Seniority seniority : values()) {
            if (seniority.code == code) {
                return seniority;
            }
        }
        throw new IllegalArgumentException("Code de séniorité inconnu : " + code);
    }

    public static Seniority fromApiValue(String value) {
        for (Seniority seniority : values()) {
            if (seniority.apiValue.equals(value)) {
                return seniority;
            }
        }
        throw new IllegalArgumentException("Valeur de séniorité inconnue : " + value);
    }
}
