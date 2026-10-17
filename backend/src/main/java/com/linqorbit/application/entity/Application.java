package com.linqorbit.application.entity;

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
 * Candidature (D49) : un couple (candidat, offre) — une seule par couple au
 * MVP (l'UNIQUE rejette même la repostulation après retrait). Le CV soumis est
 * épinglé (cv_attachment_id NOT NULL, FK composite vers attachment) et ne
 * peut être ni celui d'un autre candidat ni supprimé ensuite. matching_id est
 * rempli par le serveur uniquement (dernier matching du couple pour la fiche
 * courante) — NULL tant que le moteur de matching n'existe pas (V20 : colonne
 * seule, FK composite posée en V21) ; jamais accepté depuis le client.
 * L'id est assigné par le service : jamais d'@GeneratedValue, un id
 * pré-renseigné serait vu comme détaché par Hibernate au merge et refuserait
 * l'INSERT (piège T-58).
 */
@Entity
@Table(name = "application")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Application {

    @Id
    private UUID id;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Column(name = "cv_attachment_id", nullable = false)
    private UUID cvAttachmentId;

    @Column(name = "matching_id")
    private UUID matchingId;

    @Convert(converter = ApplicationStatusConverter.class)
    @Column(name = "status", nullable = false)
    private ApplicationStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
