package com.linqorbit.embedding.entity;

import lombok.Getter;

/**
 * États d'un job d'embedding, stockés en SMALLINT (colonne
 * embedding_job.status, jamais @Enumerated(ORDINAL)). Même vocabulaire que la
 * normalisation, table et enum propres.
 *
 * <ul>
 *   <li>{@code PENDING} — en attente de réclamation par le worker</li>
 *   <li>{@code RUNNING} — réclamé, appel d'embedding en cours</li>
 *   <li>{@code DONE} — vecteur écrit dans profile_embedding</li>
 *   <li>{@code FAILED} — 3 échecs, relancé au prochain démarrage ou à la main</li>
 *   <li>{@code SUPERSEDED} — la fiche n'est plus la fiche courante de sa
 *       source au moment de l'exécution : aucun appel au fournisseur</li>
 * </ul>
 */
@Getter
public enum EmbeddingJobStatus {

    PENDING(1),
    RUNNING(2),
    DONE(3),
    FAILED(4),
    SUPERSEDED(5);

    private final int code;

    EmbeddingJobStatus(int code) {
        this.code = code;
    }

    public static EmbeddingJobStatus fromCode(short code) {
        for (EmbeddingJobStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de job d'embedding inconnu : " + code);
    }
}
