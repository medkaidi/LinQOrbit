package com.linqorbit.screening.entity;

import java.util.Locale;

import lombok.Getter;

/**
 * États d'un job de screening, stockés en SMALLINT (colonne
 * screening_job.status, jamais @Enumerated(ORDINAL)). Même vocabulaire que
 * l'embedding, table et enum propres.
 *
 * <ul>
 *   <li>{@code PENDING} — en attente : du vecteur de l'offre, de son
 *       échéance de retry ou d'un worker</li>
 *   <li>{@code RUNNING} — réclamé, Top N en cours de calcul</li>
 *   <li>{@code DONE} — suggestions écrites dans offer_candidate</li>
 *   <li>{@code FAILED} — 3 échecs ; relance manuelle par le recruteur</li>
 *   <li>{@code SUPERSEDED} — la fiche de l'offre n'est plus la fiche courante</li>
 * </ul>
 */
@Getter
public enum ScreeningJobStatus {

    PENDING(1),
    RUNNING(2),
    DONE(3),
    FAILED(4),
    SUPERSEDED(5);

    private final int code;

    ScreeningJobStatus(int code) {
        this.code = code;
    }

    public static ScreeningJobStatus fromCode(short code) {
        for (ScreeningJobStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de job de screening inconnu : " + code);
    }

    /** Valeur exposée par l'API (signal et flux SSE) : le nom en minuscules. */
    public String getApiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
