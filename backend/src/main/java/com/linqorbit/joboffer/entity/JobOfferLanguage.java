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
 * Langue exigée par une offre : niveau CECR (A1–C2, miroir
 * candidate_languages) et caractère obligatoire ou non. Identifiants en brut,
 * comme {@code UserRole} : aucun proxy JPA dans les requêtes.
 */
@Entity
@Table(name = "job_offer_language")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(JobOfferLanguageId.class)
public class JobOfferLanguage {

    @Id
    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Id
    @Column(name = "language_id", nullable = false)
    private UUID languageId;

    @Column(name = "level", nullable = false, length = 3)
    private String level;

    @Column(name = "is_required", nullable = false)
    private Boolean isRequired;
}
