package com.linqorbit.application.dto;

import java.util.UUID;

/**
 * Option sélectionnée dans une réponse, vue candidat : identifiant et libellé
 * seulement — {@code preferred} ne sort jamais de la sphère recruteur.
 */
public record ApplicationAnswerOptionView(
        UUID optionId,
        String label) {
}
