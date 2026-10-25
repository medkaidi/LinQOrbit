package com.linqorbit.invitation.entity;

import java.util.Locale;

import lombok.Getter;

/**
 * Statut stocké d'un candidat suggéré pour une offre (colonne
 * offer_candidate.status, SMALLINT, jamais @Enumerated(ORDINAL)). « A
 * candidaté » n'est pas un statut : il est dérivé de {@code application}.
 */
@Getter
public enum OfferCandidateStatus {

    SUGGESTED(1),
    INVITED(2);

    private final int code;

    OfferCandidateStatus(int code) {
        this.code = code;
    }

    public static OfferCandidateStatus fromCode(short code) {
        for (OfferCandidateStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de candidat suggéré inconnu : " + code);
    }

    public String getApiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
