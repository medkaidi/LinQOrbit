package com.linqorbit.joboffer.entity;

import lombok.Getter;

/**
 * Statut de vie d'une offre (D13), stocké en SMALLINT (colonnes
 * job_offer.status). Cycle : DRAFT → VALIDATED → PUBLISHED → CLOSED ;
 * validate ≠ publish. Code et valeur API déclarés ensemble pour qu'aucun des
 * deux mappings ne dépende de l'ordre des constantes.
 */
@Getter
public enum JobOfferStatus {

    DRAFT(1, "draft"),
    VALIDATED(2, "validated"),
    PUBLISHED(3, "published"),
    CLOSED(4, "closed");

    private final int code;
    private final String apiValue;

    JobOfferStatus(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static JobOfferStatus fromCode(short code) {
        for (JobOfferStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut d'offre inconnu : " + code);
    }

    public static JobOfferStatus fromApiValue(String value) {
        for (JobOfferStatus status : values()) {
            if (status.apiValue.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Valeur de statut d'offre inconnue : " + value);
    }
}
