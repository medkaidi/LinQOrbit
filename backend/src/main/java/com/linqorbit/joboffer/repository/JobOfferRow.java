package com.linqorbit.joboffer.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.SalaryPeriod;
import com.linqorbit.joboffer.entity.Seniority;

/**
 * Ligne d'une liste d'offres (console admin, TD-024) : les seules colonnes que
 * la carte affiche. Projection JPQL ({@code select new …}) — la description
 * (TEXT, jusqu'à 20 000 caractères) n'est jamais lue pour une liste qui ne
 * l'affiche pas. Toute colonne ajoutée ici doit être utilisée par la carte.
 */
public record JobOfferRow(
        UUID id,
        UUID companyId,
        String title,
        JobOfferStatus status,
        String publicId,
        String slug,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDate expiresAt,
        LocalDateTime publishedAt,
        LocalDateTime validatedAt,
        Seniority seniority,
        String city,
        String country,
        UUID contractTypeId,
        UUID workModeId,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        SalaryPeriod salaryPeriod) {
}
