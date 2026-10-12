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
 * Domaine d'études accepté par une offre : simple liaison vers le vocabulaire
 * study_fields (géré en tags depuis l'autocomplete, D14). Identifiants en brut,
 * comme {@code UserRole} : aucun proxy JPA dans les requêtes.
 */
@Entity
@Table(name = "job_offer_study_field")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(JobOfferStudyFieldId.class)
public class JobOfferStudyField {

    @Id
    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Id
    @Column(name = "study_field_id", nullable = false)
    private UUID studyFieldId;
}
