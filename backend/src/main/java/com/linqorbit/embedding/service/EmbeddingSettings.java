package com.linqorbit.embedding.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.linqorbit.embedding.entity.EmbeddingJob;

import lombok.RequiredArgsConstructor;

/**
 * Couple modèle / version / stratégie <b>actif</b> (D55 : « constantes de
 * config »). Seul point de lecture : la génération, le backfill et le
 * screening désignent le même couple, jamais chacun le sien.
 *
 * <p>La stratégie est une constante de <b>code</b> (celle du
 * {@link ProfileTextRenderer}) et non une propriété : l'étiquette ne peut pas
 * dériver du rendu qu'elle décrit. Le nom du modèle est vérifié contre celui
 * que le service IA déclare avoir appelé (une désynchronisation des deux
 * configurations n'étiquette jamais un vecteur du mauvais modèle).</p>
 */
@Component
@RequiredArgsConstructor
public class EmbeddingSettings {

    /** Dimension de la colonne {@code vector(1536)} (V28) — conséquence du modèle actif. */
    public static final int DIMENSIONS = 1536;

    @Value("${app.embedding.model-name}")
    private final String modelName;
    /** Révision de l'usage du modèle (dimension, type de tâche) : à bumper si ces réglages changent. */
    @Value("${app.embedding.model-version}")
    private final String modelVersion;

    // Getters écrits à la main : un @Getter Lombok recopierait @Value sur les
    // méthodes (lombok.copyableAnnotations) et Spring le signalerait.
    public String getModelName() {
        return modelName;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public String getStrategyVersion() {
        return ProfileTextRenderer.STRATEGY_VERSION;
    }

    /** Le job vise-t-il le couple actif ? Sinon sa configuration est obsolète. */
    public boolean isActive(EmbeddingJob job) {
        return modelName.equals(job.getModelName())
                && modelVersion.equals(job.getModelVersion())
                && getStrategyVersion().equals(job.getStrategyVersion());
    }
}
