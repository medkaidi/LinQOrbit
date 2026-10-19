package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Offre vue par un membre de la company : statut portant le cycle de vie
 * DRAFT→VALIDATED→PUBLISHED→CLOSED (D13), {@code hasUnvalidatedChanges} le
 * dirty-flag (modifications post-validation, miroir candidat) que le frontend
 * affiche avant la re-validation, {@code normalizationInProgress} et
 * {@code normalizationFailed} les signaux du job de normalisation (miroir
 * candidat, pilotés par la base), {@code analysisOutdated} la fiche de
 * référence sur une version de schéma périmée (D63).
 */
public record JobOfferResponse(
        UUID id,
        UUID companyId,
        UUID recruiterId,
        String status,
        String title,
        String publicId,
        String slug,
        String description,
        String seniority,
        Integer requiredExpYear,
        String city,
        String country,
        UUID contractTypeId,
        UUID employmentTypeId,
        UUID workModeId,
        LocalDateTime validatedAt,
        LocalDateTime publishedAt,
        LocalDate expiresAt,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        int maxClarificationQuestions,
        boolean hasUnvalidatedChanges,
        boolean normalizationInProgress,
        boolean normalizationFailed,
        boolean analysisOutdated,
        List<JobOfferSkillOption> skills,
        List<JobOfferLanguageOption> languages,
        List<UUID> degreeIds,
        List<UUID> studyFieldIds,
        List<JobOfferQuestionView> questions,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
