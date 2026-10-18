package com.linqorbit.matching.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

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
 * Suivi d'exécution d'un {@link MatchingResult}, miroir exact de
 * {@code NormalizationJob} (D51) : shared PK {@code job_id ≡
 * matching_result_id} (la PK porte la FK), claim CAS multi-instances,
 * {@code attempts} = échecs cumulés, {@code next_attempt_at} = échéance du
 * prochain essai.
 */
@Entity
@Table(name = "matching_job")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class MatchingJob {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID id;

    @Convert(converter = MatchingJobStatusConverter.class)
    @Column(name = "status", nullable = false)
    private MatchingJobStatus status;

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
