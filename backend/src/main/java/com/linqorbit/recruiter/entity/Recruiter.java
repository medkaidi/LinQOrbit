package com.linqorbit.recruiter.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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
 * Identité recruteur. La ligne est créée par une action explicite du compte
 * (POST /api/v1/recruiters/me) et réutilise l'identifiant du compte (clé
 * primaire partagée, voir users) : l'id est donc toujours assigné, jamais
 * généré. L'identité nominative (nom, photo, e-mail) reste sur users — voir
 * D10. Construction : builder uniquement (voir AGENTS), setters réservés aux
 * mises à jour.
 */
@Entity
@Table(name = "recruiters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Recruiter {

    @Id
    private UUID id;

    @Column(name = "headline", length = 100)
    private String headline;

    @Column(name = "bio", length = 2000)
    private String bio;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
