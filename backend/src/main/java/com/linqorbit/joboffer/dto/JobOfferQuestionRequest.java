package com.linqorbit.joboffer.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Question de présélection dans une demande de création / modification
 * d'offre (D47) : label (1–500), type parmi les 5 valeurs API (« text »,
 * « single_choice », « multiple_choice », « yes_no », « number » — validé par
 * le service, miroir de requirementType), obligatoire ou non (absent → false)
 * et ordre (≥ 0, explicitement requis : le client envoie la position).
 * Les options ne sont admises que sur les questions à choix, et exigées pour
 * elles (règle de service — la base ne lit pas le type).
 */
public record JobOfferQuestionRequest(
        @NotBlank(message = "must not be blank") @Size(max = 500, message = "must be at most 500 characters") String label,
        @NotBlank(message = "must not be blank") String type, Boolean isRequired,
        @NotNull(message = "must not be null") @Min(value = 0, message = "must be at least 0") Integer sortOrder,
        @Valid List<JobOfferQuestionOptionRequest> options) {

    public JobOfferQuestionRequest {
        options = options == null ? List.of() : options;
    }
}
