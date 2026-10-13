package com.linqorbit.joboffer.entity;

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
 * Association normalisé ↔ offre d'emploi, miroir de
 * {@code normalized_profile_candidate} : le profil EST le porteur de la
 * liaison vers sa source (un profil appartient à un candidat XOR à une
 * offre). Clés brutes sans association JPA — la navigation se fait par
 * requête.
 */
@Entity
@Table(name = "normalized_profile_job_offer")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(NormalizedProfileJobOfferId.class)
public class NormalizedProfileJobOffer {

    @Id
    @Column(name = "normalized_profile_id", nullable = false)
    private UUID normalizedProfileId;

    @Id
    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;
}
