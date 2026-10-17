package com.linqorbit.joboffer.dto;

import java.util.List;
import java.util.UUID;

/**
 * Question de présélection vue par un membre de la company (D47) : jamais
 * servie au public en l'état — {@code preferred} est une information
 * recruteur seule (la fiche publique des candidatures n'expose que les
 * libellés, via le domaine application).
 */
public record JobOfferQuestionView(
        UUID id,
        String label,
        String type,
        boolean isRequired,
        int sortOrder,
        List<JobOfferQuestionOptionView> options) {
}
