package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Ligne du job board public (T-72) : vue légère d'une offre publiée — la
 * description et les listes enfants restent réservées à la fiche
 * {@link PublicJobResponse}, seules les compétences sont exposées en libellés
 * complets (T-76, transparence candidat : aucune n'est omise), ordonnées poids
 * décroissant puis nom. Les vocabulaires sont déjà résolus en labels (le
 * visiteur n'a pas les référentiels) ; jamais recruiterId, statut ou signal de
 * gestion.
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
        List<String> skills,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        LocalDateTime publishedAt,
        LocalDate expiresAt) {
}
