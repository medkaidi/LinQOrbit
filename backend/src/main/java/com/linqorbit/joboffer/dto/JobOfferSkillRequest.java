package com.linqorbit.joboffer.dto;

import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Compétence exigée dans une demande de création / modification d'offre :
 * type d'exigence (mandatory/preferred), poids 1–5 (§7, borné en attendant
 * le moteur) et années d'expérience requises.
 */
public record JobOfferSkillRequest(
        @NotNull(message = "must not be null") UUID skillId,
        @NotNull(message = "must not be null") String requirementType,
        @NotNull(message = "must not be null")
        @Min(value = 1, message = "must be at least 1") @Max(value = 5, message = "must be at most 5") Integer weight,
        @Min(value = 0, message = "must be at least 0") @Max(value = 60, message = "must be at most 60") Integer yearsExperience) {
}
