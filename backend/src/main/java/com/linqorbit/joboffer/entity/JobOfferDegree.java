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
 * Diplôme accepté par une offre : simple liaison vers le vocabulaire
 * degrees (géré en tags depuis l'autocomplete, D14). Identifiants en brut,
 * comme {@code UserRole} : aucun proxy JPA dans les requêtes.
 */
@Entity
@Table(name = "job_offer_degree")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(JobOfferDegreeId.class)
public class JobOfferDegree {

    @Id
    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Id
    @Column(name = "degree_id", nullable = false)
    private UUID degreeId;
}
