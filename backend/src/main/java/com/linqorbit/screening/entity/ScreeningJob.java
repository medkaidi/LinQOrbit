package com.linqorbit.screening.entity;

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
 * Suivi d'exécution du screening automatique d'une offre publiée (T-101,
 * D85) : un job par fiche d'offre. Le job est la trace d'exécution ; le Top N
 * qu'il produit vit dans {@code offer_candidate}.
 *
 * <p>Claim sûr multi-instances par CAS ({@code WHERE status = PENDING}),
 * comme {@code EmbeddingJob}. Les transitions passent par les UPDATE du
 * repository, jamais par les setters. L'id est assigné par le service.</p>
 */
@Entity
@Table(name = "screening_job")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class ScreeningJob {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID id;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "offer_normalized_profile_id", nullable = false)
    private UUID offerNormalizedProfileId;

    @Convert(converter = ScreeningJobStatusConverter.class)
    @Column(name = "status", nullable = false)
    private ScreeningJobStatus status;

    @Column(name = "attempts", nullable = false)
    private Integer attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    /** NULL tant que le job n'est pas DONE. */
    @Column(name = "candidate_count")
    private Integer candidateCount;

    @Column(name = "error", length = 500)
    private String error;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
