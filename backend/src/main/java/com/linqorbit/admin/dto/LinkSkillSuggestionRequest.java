package com.linqorbit.admin.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

/**
 * Relie une suggestion à une compétence déjà présente dans le catalogue
 * (correspondance repérée par l'administrateur, aucune création).
 */
public record LinkSkillSuggestionRequest(@NotNull UUID skillId) {
}
