package com.linqorbit.matching.entity;

import lombok.Getter;

/**
 * Statut d'une clarification IA (D52), stocké en SMALLINT : 1 OPEN (posée,
 * en attente), 2 ANSWERED (répondue, déclenche une réévaluation), 3 SKIPPED
 * (passée ou fermée par la fin d'évaluation — consomme un cran du plafond).
 * Code et valeur API déclarés ensemble.
 */
@Getter
public enum ClarificationStatus {
    OPEN(1, "open"),
    ANSWERED(2, "answered"),
    SKIPPED(3, "skipped");

    private final int code;
    private final String apiValue;

    ClarificationStatus(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static ClarificationStatus fromCode(short code) {
        for (ClarificationStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de clarification inconnu : " + code);
    }
}
