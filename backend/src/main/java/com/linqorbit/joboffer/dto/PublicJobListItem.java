package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ligne du job board public (T-72) : vue légère d'une offre publiée — ni
 * description ni listes enfants (réservées à la fiche {@link PublicJobResponse}).
 * Les vocabulaires sont déjà résolus en labels (le visiteur n'a pas les
 * référentiels) ; jamais recruiterId, statut ou signal de gestion.
 */
public record PublicJobListItem(
        String publicId,
        String slug,
        String title,
        String companyName,
        String seniority,
        String city,
        String country,
        String contractType,
        String employmentType,
        String workMode,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        LocalDateTime publishedAt,
        LocalDate expiresAt) {
}
