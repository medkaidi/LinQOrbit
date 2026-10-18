package com.linqorbit.matching.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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
 * Matching (D50) : identité = le couple (candidat, offre) + la version de
 * fiche normalisée du candidat évaluée. Fiche inchangée → le matching est
 * repris ; fiche régénérée → un nouveau matching naît de zéro (l'ancien reste
 * en base, tracé, jamais repris). Mapping « table-mapper » : ids FK en
 * colonnes, aucune association. L'id est assigné par le service (jamais
 * d'{@code @GeneratedValue}).
 */
@Entity
@Table(name = "matching")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Matching {

    @Id
    private UUID id;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "candidate_normalized_profile_id", nullable = false)
    private UUID candidateNormalizedProfileId;

    /** Fin d'évaluation (clarifications T-62, contestation T-63) ; nul tant qu'elle reste ouverte. */
    @Column(name = "assessment_finished_at")
    private LocalDateTime assessmentFinishedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
