package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Fiche publique d'une offre publiée (V15) : ce qui mérite d'être vu hors
 * espace recruteur — pas de recruiterId, ni de statut, ni de dirty-flag.
 * Les vocabulaires sont résolus en labels ; la description est le HTML déjà
 * sanitisé stocké en base (D19).
 */
public record PublicJobResponse(
        String publicId,
        String slug,
        String title,
        String description,
        String seniority,
        Integer requiredExpYear,
        String city,
        String country,
        String companyName,
        String contractType,
        String employmentType,
        String workMode,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        LocalDate expiresAt,
        List<JobOfferSkillOption> skills,
        List<JobOfferLanguageOption> languages,
        List<String> degreeLabels,
        List<String> studyFieldLabels,
        LocalDateTime publishedAt) {
}
