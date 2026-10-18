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
 * Candidature (D49, D59) : un couple (candidat, offre) — une seule par couple,
 * quel que soit le statut (l'UNIQUE rejette même la repostulation après
 * retrait). Elle naît en brouillon : le CV courant y est renseigné quand il
 * existe, reste modifiable tant que DRAFT et est épinglé à la transmission
 * (FK composite vers attachment : jamais le CV d'un autre candidat, jamais
 * supprimable ensuite) — seul un brouillon peut ne pas en avoir encore (CHECK
 * V21). matching_id est posé par le serveur uniquement, à la transmission
 * (dernier matching du couple pour la fiche courante ; NULL = candidature
 * directe) ; jamais accepté depuis le client.
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

    @Column(name = "cv_attachment_id")
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
