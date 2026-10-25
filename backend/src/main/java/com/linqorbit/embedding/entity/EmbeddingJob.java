package com.linqorbit.embedding.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Suivi d'exécution de la génération d'un embedding : un job par couple
 * (fiche normalisée, modèle, version du modèle, stratégie de rendu). Le job
 * est la trace d'exécution, le vecteur lui-même vit dans
 * {@code profile_embedding}.
 *
 * <p>Claim sûr multi-instances par CAS ({@code WHERE status = PENDING}),
 * comme {@code NormalizationJob}. Les transitions passent par les UPDATE du
 * repository, jamais par les setters. L'id est assigné par le service.</p>
 */
@Entity
@Table(name = "embedding_job")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class EmbeddingJob {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID id;

    @Column(name = "normalized_profile_id", nullable = false)
    private UUID normalizedProfileId;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(name = "strategy_version", nullable = false, length = 50)
    private String strategyVersion;

    @Convert(converter = EmbeddingJobStatusConverter.class)
    @Column(name = "status", nullable = false)
    private EmbeddingJobStatus status;

    @Column(name = "attempts", nullable = false)
    private Integer attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "error", length = 500)
    private String error;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
