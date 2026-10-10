package com.linqorbit.candidate.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload d'écriture de la section Projets : le tableau reçu remplace
 * intégralement la liste existante (même contrat que les expériences).
 * technologies = liste libre séparée par des virgules (canonicalisation et
 * extraction de compétences = fiche normalisée v2 côté IA).
 */
public record ProjectRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 255) String role,
        @Size(max = 2000) String description,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @Size(max = 1000) String technologies) {
}
