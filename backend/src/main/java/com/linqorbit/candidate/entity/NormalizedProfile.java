package com.linqorbit.candidate.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

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
 * Profil candidat normalisé (objet canonique produit par le service IA) :
 * une ligne par VALIDATION du profil par l'utilisateur. {@code content} NULL
 * = en cours d'analyse, échec ou jamais rempli ; rempli par le worker à la
 * fin de l'appel au service IA.
 *
 * <p>L'id est toujours assigné, jamais généré : il sert aussi de clé
 * primaire au job d'exécution (shared PK, voir {@link NormalizationJob}).
 * La version est numérotée par candidat côté application (lock pessimiste
 * de la ligne candidat dans la tx de validation).</p>
 */
@Entity
@Table(name = "normalized_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class NormalizedProfile {

    @Id
    @Column(name = "normalized_profile_id", nullable = false)
    private UUID id;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "schema_version", nullable = false, length = 8)
    private String schemaVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content")
    private String content;

    @Column(name = "validated_at", nullable = false)
    private LocalDateTime validatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
