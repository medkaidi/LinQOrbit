package com.linqorbit.matching.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
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
 * Résultat versionné d'un matching (D51) : {@code version = max + 1} sous
 * verrou pessimiste de la ligne matching. {@code result} NULL = analyse en
 * cours ou en échec (miroir de {@code normalized_profile.content}) ;
 * {@code schema_version} = contrat du JSON. Chaque résultat enregistre la
 * fiche offre utilisée. {@code clarification_id} : réponse ayant déclenché la
 * réévaluation (T-62 — FK posée en V22).
 */
@Entity
@Table(name = "matching_result")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class MatchingResult {

    @Id
    private UUID id;

    @Column(name = "matching_id", nullable = false)
    private UUID matchingId;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "schema_version", nullable = false, length = 8)
    private String schemaVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result")
    private String result;

    @Column(name = "job_offer_normalized_profile_id", nullable = false)
    private UUID jobOfferNormalizedProfileId;

    @Column(name = "clarification_id")
    private UUID clarificationId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
