package com.linqorbit.candidate.entity;

import lombok.Getter;

/**
 * États d'un job de normalisation, stockés en VARCHAR (colonne
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

    PENDING,
    RUNNING,
    DONE,
    FAILED,
    SUPERSEDED
}
