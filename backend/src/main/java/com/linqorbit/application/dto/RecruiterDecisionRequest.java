package com.linqorbit.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Décision manuelle et terminale du recruteur : {@code accepted} ou {@code rejected}. */
public record RecruiterDecisionRequest(
        @NotBlank
        @Pattern(regexp = "accepted|rejected", message = "must be accepted or rejected")
        String decision) {
}
