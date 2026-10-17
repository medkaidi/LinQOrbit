package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Option d'une question de choix (D47) : {@code preferred} = information
 * recruteur seule (jamais affichée au candidat).
 */
public record JobOfferQuestionOptionView(
        UUID id,
        String label,
        int sortOrder,
        boolean preferred) {
}
