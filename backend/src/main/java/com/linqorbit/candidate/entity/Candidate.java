package com.linqorbit.candidate.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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
 * Profil candidat. La ligne est créée à la première écriture du profil et
 * réutilise l'identifiant du compte (clé primaire partagée, voir users) :
 * l'id est donc toujours assigné, jamais généré.
 * Construction : builder uniquement (voir AGENTS), setters réservés aux mises à jour.
 */
@Entity
@Table(name = "candidates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Candidate {

    @Id
    private UUID id;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "target_position", length = 255)
    private String targetPosition;

    @Column(name = "bio", length = 2000)
    private String bio;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Convert(converter = SearchStatusConverter.class)
    @Column(name = "search_status")
    private SearchStatus searchStatus;

    /**
     * CV courant (pointeur vers attachment) : écrit uniquement par UPDATE bulk
     * ({@code CandidateRepository#updateCurrentCvAttachmentId}) — passer par un
     * save d'entité bumperait updated_at et ferait croire à une modification du
     * profil (dirty-flag). Peut être vide même avec des CV déposés.
     */
    @Column(name = "current_cv_attachment_id")
    private UUID currentCvAttachmentId;

    /**
     * Consentement à la visibilité du profil complet par les recruteurs (T-102,
     * D86) : date de l'acte et version du texte accepté, {@code NULL} ensemble
     * = pas de consentement (V30). Écrits uniquement par UPDATE bulk
     * ({@code CandidateRepository#updateRecruiterVisibilityConsent}) : un save
     * d'entité bumperait updated_at (dirty-flag du profil) ; {@code updatable =
     * false} garantit qu'un save ne les écrase jamais.
     */
    @Column(name = "recruiter_visibility_consent_at", updatable = false)
    private LocalDateTime recruiterVisibilityConsentAt;

    @Column(name = "recruiter_visibility_consent_version", updatable = false)
    private Short recruiterVisibilityConsentVersion;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
