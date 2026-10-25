package com.linqorbit.invitation.entity;

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
 * Candidat suggéré pour une offre par le screening, puis éventuellement
 * invité à candidater (T-101, D85). Ligne = résultat figé du screening
 * (rang, distance) ; {@code candidateId} et {@code candidateNormalizedProfileId}
 * ne sont <b>jamais</b> exposés par l'API : seul {@code id} (propre à l'offre)
 * identifie la carte (jamais l'id du candidat). Le passage SUGGESTED → INVITED passe par
 * l'UPDATE conditionnel du repository.
 */
@Entity
@Table(name = "offer_candidate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class OfferCandidate {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "candidate_normalized_profile_id", nullable = false)
    private UUID candidateNormalizedProfileId;

    @Column(name = "screening_job_id", nullable = false)
    private UUID screeningJobId;

    @Column(name = "rank", nullable = false)
    private Integer rank;

    @Column(name = "distance", nullable = false)
    private Double distance;

    @Convert(converter = OfferCandidateStatusConverter.class)
    @Column(name = "status", nullable = false)
    private OfferCandidateStatus status;

    @Column(name = "invited_by_user_id")
    private UUID invitedByUserId;

    @Column(name = "invited_at")
    private LocalDateTime invitedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
