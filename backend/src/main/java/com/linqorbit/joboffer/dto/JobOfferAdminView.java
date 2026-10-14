package com.linqorbit.joboffer.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Vue admin d'une offre (D33) : la fiche publique (labels résolus) sans la
 * gate published / non expirée, augmentée de l'identifiant, du statut de vie
 * et des horodatages. Consultation seule depuis la console d'administration.
 */
public record JobOfferAdminView(
        UUID id,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        PublicJobResponse detail) {
}
