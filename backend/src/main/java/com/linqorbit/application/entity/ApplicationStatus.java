package com.linqorbit.application.entity;

import lombok.Getter;

/**
 * Statut d'une candidature (D49, révisé par D59), stocké en SMALLINT
 * (colonne application.status). Cycle : DRAFT (brouillon — réponses aux
 * questions du recruteur remplaçables, matching ouvert) → SUBMITTED
 * (transmise, réponses figées) → WITHDRAWN (retrait candidat, terminal —
 * l'UNIQUE du couple interdit la repostulation) ou ACCEPTED / REJECTED
 * (décisions recruteur, T-66). Les codes sont des identifiants, jamais un
 * ordre : aucune logique ne les compare. Code et valeur API déclarés ensemble
 * pour qu'aucun des deux mappings ne dépende de l'ordre des constantes.
 */
@Getter
public enum ApplicationStatus {

    DRAFT(1, "draft"),
    SUBMITTED(2, "submitted"),
    WITHDRAWN(3, "withdrawn"),
    ACCEPTED(4, "accepted"),
    REJECTED(5, "rejected");

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
