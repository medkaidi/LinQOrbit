package com.linqorbit.application.dto;

import java.util.UUID;

/** Option choisie par le candidat, avec son indicateur recruteur {@code preferred}. */
public record RecruiterAnswerOptionView(
        UUID id,
        String label,
        boolean preferred) {
}
