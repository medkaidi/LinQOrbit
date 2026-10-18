package com.linqorbit.matching.dto;

import jakarta.validation.constraints.NotBlank;

/** Lancement (ou reprise) du matching du candidat connecté sur une offre publiée. */
public record StartMatchingRequest(@NotBlank(message = "must not be blank") String jobPublicId) {
}
