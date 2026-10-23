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
 * Revue interne finale d'un signalement d'évaluation IA par un administrateur
 * (T-96, D77/D78) : un seul avis par admin et par signalement, append-only
 * (aucun {@code updated_at}, aucune édition, aucune suppression).
 *
 * <p>La revue est totalement aveugle : chaque admin ne lit que son propre
 * avis. Les corrections ({@code correctedScore}, {@code correctedRationale})
 * ne sont possibles que pour un verdict {@link CriterionReportReviewVerdict#UPHELD}
 * et restent facultatives séparément ; la review n'est training-ready que
 * lorsque les deux sont renseignés. Aucune moyenne n'est calculée et la revue
 * ne modifie jamais le signalement, le résultat épinglé, le score ou la
 * décision.</p>
 */
@Entity
@Table(name = "matching_criterion_report_review")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class MatchingCriterionReportReview {

    @Id
    private UUID id;

    @Column(name = "report_id", nullable = false)
    private UUID reportId;

    @Column(name = "reviewer_user_id", nullable = false)
    private UUID reviewerUserId;

    @Convert(converter = CriterionReportReviewVerdictConverter.class)
    @Column(name = "verdict", nullable = false)
    private CriterionReportReviewVerdict verdict;

    @Column(name = "note", length = 2000)
    private String note;

    @Column(name = "corrected_score")
    private Integer correctedScore;

    @Column(name = "corrected_rationale", length = 2000)
    private String correctedRationale;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
