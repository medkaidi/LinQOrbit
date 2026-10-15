package com.linqorbit.admin.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Ligne de la liste globale des offres (console admin) : vue légère pour le
 * tri et le filtre — la fiche complète se consulte par l'endpoint détail.
 * Porte les mêmes signaux d'affichage que la carte du recruteur (séniorité,
 * lieu, vocabulaire, salaire, dirty-flag) pour partager la même carte ;
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
        String seniority,
        String city,
        String country,
        UUID contractTypeId,
        UUID workModeId,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        boolean hasUnvalidatedChanges,
        String normalizationJobStatus) {
}
