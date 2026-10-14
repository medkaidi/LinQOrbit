package com.linqorbit.admin.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Ligne de la liste globale des offres (console admin) : vue légère pour le
 * tri et le filtre — la fiche complète se consulte par l'endpoint détail.
 * {@code normalizationJobStatus} en minuscules (pending|running|done|failed)
 * ou NULL si l'offre n'a jamais été validée.
 */
public record AdminJobOfferListItem(
        UUID id,
        String title,
        String status,
        String companyName,
        String publicId,
        String slug,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDate expiresAt,
        LocalDateTime publishedAt,
        String normalizationJobStatus) {
}
