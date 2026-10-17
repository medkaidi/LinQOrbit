package com.linqorbit.application.entity;

import lombok.Getter;

/**
 * Statut d'une candidature (D49), stocké en SMALLINT (colonne
 * application.status). Cycle au MVP : SUBMITTED → WITHDRAWN (retrait
 * candidat, terminal — l'UNIQUE du couple interdit la repostulation),
 * ACCEPTED / REJECTED (décisions recruteur, T-66). Code et valeur API
 * déclarés ensemble pour qu'aucun des deux mappings ne dépende de l'ordre des
 * constantes.
 */
@Getter
public enum ApplicationStatus {

    SUBMITTED(1, "submitted"),
    WITHDRAWN(2, "withdrawn"),
    ACCEPTED(3, "accepted"),
    REJECTED(4, "rejected");

    private final int code;
    private final String apiValue;

    ApplicationStatus(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static ApplicationStatus fromCode(short code) {
        for (ApplicationStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de candidature inconnu : " + code);
    }

    public static ApplicationStatus fromApiValue(String value) {
        for (ApplicationStatus status : values()) {
            if (status.apiValue.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Valeur de statut de candidature inconnue : " + value);
    }
}
