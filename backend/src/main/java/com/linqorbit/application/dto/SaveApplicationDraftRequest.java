package com.linqorbit.application.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Enregistrement du brouillon de candidature (D59) : l'offre par son
 * identifiant public et les réponses aux questions du recruteur. Crée le
 * brouillon au premier enregistrement, remplace ses réponses ensuite.
 * {@code answers} est facultatif (absent ≡ vide) : un brouillon peut être
 * partiel — les obligatoires ne sont exigées qu'avant le matching et à la
 * transmission ; chaque réponse fournie doit en revanche être valide (400).
 */
public record SaveApplicationDraftRequest(
        @NotBlank(message = "must not be blank") String jobPublicId,
        List<@NotNull @Valid ApplicationAnswerRequest> answers) {

    public SaveApplicationDraftRequest {
        answers = answers == null ? List.of() : answers;
    }
}
