package com.linqorbit.candidate.entity;

import lombok.Getter;

/**
 * États d'un job de normalisation, stockés en SMALLINT (colonne
 * normalization_job.status, jamais @Enumerated(ORDINAL)).
 *
 * <ul>
 *   <li>{@code PENDING} — en attente de réclamation par le worker</li>
 *   <li>{@code RUNNING} — réclamé, appel IA en cours</li>
 *   <li>{@code DONE} — content rempli</li>
 *   <li>{@code FAILED} — 3 échecs, content reste NULL (audit)</li>
 *   <li>{@code SUPERSEDED} — remplacé par une validation postérieure,
 *       jamais exécuté (zéro coût LLM)</li>
 * </ul>
 */
@Getter
public enum NormalizationJobStatus {

    PENDING(1),
    RUNNING(2),
    DONE(3),
    FAILED(4),
    SUPERSEDED(5);

    private final int code;

    NormalizationJobStatus(int code) {
        this.code = code;
    }

    public static NormalizationJobStatus fromCode(short code) {
        for (NormalizationJobStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de job inconnu : " + code);
    }
}
