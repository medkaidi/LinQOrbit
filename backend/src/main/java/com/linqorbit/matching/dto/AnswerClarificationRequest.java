package com.linqorbit.matching.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Réponse du candidat à la question IA ouverte (T-62), texte brut. */
public record AnswerClarificationRequest(
        @NotBlank(message = "must not be blank") @Size(max = 3000, message = "must be at most 3000 characters") String answer) {
}
