package com.linqorbit.attachment.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

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
 * Pièce jointe de candidat (CV en V18). Le fichier vit sur disque (storage_path
 * relatif à la racine de stockage) ; la ligne est la vérité en base : nom
 * d'origine, type, taille et empreinte sha256. uq_attachment_candidate_id est
 * la cible des FK composites des candidatures (V20). Les anciens CV ne sont
 * jamais supprimés automatiquement — remplacer un CV = en déposer un nouveau.
 * L'id est assigné par le service avant l'écriture du fichier (le storage_path
 * le porte) : jamais d'@GeneratedValue, un id pré-renseigné serait vu comme
 * détaché par Hibernate au merge et refuserait l'INSERT.
 */
@Entity
@Table(name = "attachment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Attachment {

    @Id
    private UUID id;

    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
