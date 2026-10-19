package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Création d'offre (D12–D14) : l'offre est créée en DRAFT ; l'appartenance à
 * la company est vérifiée par le service (membership, pas de rôle). La
 * complétude minimale (titre, description, country, employment type, ≥ 1
 * skill) est exigée dès la création — un brouillon n'existe jamais vide.
 */
public record CreateJobOfferRequest(
        @NotNull(message = "must not be null") UUID companyId,
        @NotBlank(message = "must not be blank") @Size(max = 255, message = "must be at most 255 characters") String title,
        @NotBlank(message = "must not be blank") @Size(max = 20000, message = "must be at most 20000 characters") String description,
        @Pattern(regexp = "junior|mid|senior|lead|principal", message = "must be one of junior, mid, senior, lead, principal") String seniority,
        @Min(value = 0, message = "must be at least 0") @Max(value = 60, message = "must be at most 60") Integer requiredExpYear,
        @Size(max = 255, message = "must be at most 255 characters") String city,
        @NotBlank(message = "must not be blank") @Pattern(regexp = "[A-Z]{2}", message = "must be a 2-letter ISO country code") String country,
        UUID contractTypeId,
        @NotNull(message = "must not be null") UUID employmentTypeId,
        UUID workModeId,
        @FutureOrPresent(message = "must be today or later") LocalDate expiresAt,
        @PositiveOrZero(message = "must be 0 or more") BigDecimal salaryMin,
        @PositiveOrZero(message = "must be 0 or more") BigDecimal salaryMax,
        @Size(min = 3, max = 3, message = "must be a 3-letter ISO currency code") String salaryCurrency,
        @Pattern(regexp = "year|month|day|hour", message = "must be one of year, month, day, hour") String salaryPeriod,
        @Size(min = 1, message = "must contain at least one skill") @Valid List<JobOfferSkillRequest> skills,
        @Valid List<JobOfferLanguageRequest> languages,
        List<UUID> degreeIds,
        List<UUID> studyFieldIds,
        @Valid List<JobOfferQuestionRequest> questions,
        @Min(value = 0, message = "must be at least 0") @Max(value = 10, message = "must be at most 10") Integer maxClarificationQuestions) {

    public CreateJobOfferRequest {
        skills = skills == null ? List.of() : skills;
        languages = languages == null ? List.of() : languages;
        degreeIds = degreeIds == null ? List.of() : degreeIds;
        studyFieldIds = studyFieldIds == null ? List.of() : studyFieldIds;
        questions = questions == null ? List.of() : questions;
    }
}
