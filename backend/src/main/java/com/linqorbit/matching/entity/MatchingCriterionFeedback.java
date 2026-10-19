package com.linqorbit.matching.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
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
 * Contestation du candidat sur un critère du dernier résultat (T-63, D54
 * révisée par D62) : son score propre 0–100 et un commentaire texte
 * facultatif. Modifiable jusqu'à la transmission de la candidature
 * ({@code updatedAt} posé par le service à chaque enregistrement,
 * {@code createdAt} conservé), figée ensuite. Ne modifie jamais le résultat.
 */
@Entity
@Table(name = "matching_criterion_feedback")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class MatchingCriterionFeedback {

    @Id
    private UUID id;

    @Column(name = "matching_id", nullable = false)
    private UUID matchingId;

    @Column(name = "matching_result_id", nullable = false)
    private UUID matchingResultId;

    @Column(name = "criterion_key", nullable = false, length = 200)
    private String criterionKey;

    @Column(name = "self_value", nullable = false)
    private Integer selfValue;

    @Column(name = "comment", length = 2000)
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
