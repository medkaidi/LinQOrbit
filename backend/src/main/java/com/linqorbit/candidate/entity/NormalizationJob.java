package com.linqorbit.candidate.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.linqorbit.candidate.NormalizationJobStatus;
import com.linqorbit.candidate.NormalizationJobStatusConverter;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Suivi d'exécution d'un {@link NormalizedProfile} : le job n'est que la
 * trace d'exécution du profil, jamais l'inverse (jamais de job sans profil).
 * Shared PK : {@code job_id ≡ normalized_profile_id}, la PK porte la FK
 * (intégrité sans colonne redondante) — l'id est donc toujours assigné.
 *
 * <p>Claim sûr multi-instances : {@code UPDATE … SET status='RUNNING'
 * WHERE id = ? AND status = 'PENDING'}.</p>
 */
@Entity
@Table(name = "normalization_job")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class NormalizationJob {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID id;

    @Convert(converter = NormalizationJobStatusConverter.class)
    @Column(name = "status", nullable = false, length = 12)
    private NormalizationJobStatus status;

    @Column(name = "attempts", nullable = false)
    private Integer attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "error", length = 500)
    private String error;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
