package com.linqorbit.joboffer.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Langue exigée dans une demande de création / modification d'offre : niveau
 * CECR (miroir candidate_languages) et caractère obligatoire ou non.
 */
public record JobOfferLanguageRequest(
        @NotNull(message = "must not be null") UUID languageId,
        @NotBlank(message = "must not be blank") @Pattern(regexp = "A1|A2|B1|B2|C1|C2", message = "must be one of A1, A2, B1, B2, C1, C2") String level,
        boolean isRequired) {
}
