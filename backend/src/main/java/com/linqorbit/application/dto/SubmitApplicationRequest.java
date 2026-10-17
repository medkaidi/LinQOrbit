package com.linqorbit.application.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Soumission d'une candidature (D49) : l'offre par son identifiant public et
 * les réponses aux questions de présélection. {@code cvAttachmentId} est
 * facultatif — absent, le CV courant du candidat est épinglé ; présent, il
 * doit appartenir au candidat (les anciens CV restent candidats au choix).
 * {@code answers} est facultatif (absent ≡ vide) : les questions obligatoires
 * non répondues sont refusées en service (400).
 */
public record SubmitApplicationRequest(
        @NotBlank(message = "must not be blank") String jobPublicId,
        UUID cvAttachmentId,
        List<@NotNull @Valid ApplicationAnswerRequest> answers) {

    public SubmitApplicationRequest {
        answers = answers == null ? List.of() : answers;
    }
}
