package com.linqorbit.candidate.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Association normalisé ↔ candidat : le profil EST le porteur de la liaison
 * vers sa source (exclusivité des sources : un profil appartient à un
 * candidat XOR à une offre ; l'association avec les futures job_offers
 * viendra avec la table des offres). Clés brutes sans association JPA,
 * à l'image de {@code user_roles} — la navigation se fait par requête.
 */
@Entity
@Table(name = "normalized_profile_candidate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(NormalizedProfileCandidateId.class)
public class NormalizedProfileCandidate {

    @Id
    @Column(name = "normalized_profile_id", nullable = false)
    private UUID normalizedProfileId;

    @Id
    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;
}
