package com.linqorbit.matching.entity;

import lombok.Getter;

/**
 * Statut d'un job de matching (D51), stocké en SMALLINT : 1 PENDING,
 * 2 RUNNING, 3 DONE, 4 FAILED. Pas de SUPERSEDED (contrairement à la
 * normalisation) : une nouvelle analyse n'est créée qu'après un échec, jamais
 * pendant une analyse en vol. Code et valeur API déclarés ensemble.
 */
@Getter
public enum MatchingJobStatus {

    PENDING(1, "pending"),
    RUNNING(2, "running"),
    DONE(3, "done"),
    FAILED(4, "failed");

    private final int code;
    private final String apiValue;

    MatchingJobStatus(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static MatchingJobStatus fromCode(short code) {
        for (MatchingJobStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de job de matching inconnu : " + code);
    }
}
