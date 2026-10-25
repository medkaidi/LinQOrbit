package com.linqorbit.embedding.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Métadonnées d'un embedding de fiche normalisée (lecture seule). La colonne
 * {@code embedding vector(1536)} n'est volontairement <b>pas</b> mappée : le
 * backend ne lit jamais un vecteur en Java (la similarité se calcule en SQL,
 * {@code ScreeningRepository}) et l'écrit par SQL natif
 * ({@code ProfileEmbeddingRepository.insertIfAbsent}) — aucune dépendance
 * {@code hibernate-vector}, {@code ddl-auto: validate} n'exigeant pas que
 * toutes les colonnes soient mappées. Les lignes ne sont jamais créées par JPA.
 */
@Entity
@Immutable
@Table(name = "profile_embedding")
@Getter
@NoArgsConstructor
public class ProfileEmbedding {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "normalized_profile_id", nullable = false)
    private UUID normalizedProfileId;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(name = "strategy_version", nullable = false, length = 50)
    private String strategyVersion;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
