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
 * Signalement interne d'une évaluation IA par critère (T-86, D66) : motif
 * (5 valeurs) + commentaire facultatif — obligatoire pour le motif « autre ».
 * Rattaché au {@code matching_result_id} exact (le résultat affiché au
 * recruteur), avec son auteur.
 *
 * <p>Immuable : aucun {@code updated_at}, aucune édition, aucun
 * {@code updatedAt}. Ne modifie jamais {@code matching_result} et ne
 * déclenche aucune réévaluation.</p>
 */
@Entity
@Table(name = "matching_criterion_report")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class MatchingCriterionReport {

    @Id
    private UUID id;

    @Column(name = "matching_id", nullable = false)
    private UUID matchingId;

    @Column(name = "matching_result_id", nullable = false)
    private UUID matchingResultId;

    @Column(name = "criterion_key", nullable = false, length = 200)
    private String criterionKey;

    @Column(name = "author_user_id", nullable = false)
    private UUID authorUserId;

    @Convert(converter = CriterionReportReasonConverter.class)
    @Column(name = "reason", nullable = false)
    private CriterionReportReason reason;

    @Column(name = "comment", length = 2000)
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
