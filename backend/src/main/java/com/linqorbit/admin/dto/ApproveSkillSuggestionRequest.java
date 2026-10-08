package com.linqorbit.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Approbation d'une suggestion de compétence : la catégorie doit exister déjà
 * dans le catalogue, le type suit la valeur API de {@code SkillType}
 * ({@code tech} / {@code soft}).
 */
public record ApproveSkillSuggestionRequest(
        @NotBlank @Size(max = 50) String category,
        @NotBlank String skillType) {
}
