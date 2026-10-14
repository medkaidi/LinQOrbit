package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

import com.linqorbit.joboffer.dto.PublicJobResponse;

/**
 * Détail d'une offre pour la console admin : la fiche publique (labels
 * résolus, HTML sanitisé) telle quelle, augmentée de l'identifiant, du statut
 * de vie et des horodatages — la consultation admin ne gate ni la publication
 * ni l'expiration.
 */
public record AdminJobOfferDetailResponse(
        UUID id,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        PublicJobResponse detail) {
}
