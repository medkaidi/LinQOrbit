package com.linqorbit.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Question de présélection servie au candidat : contrat allégé de
 * {@code JobOfferQuestionView} (domaine joboffer) — jamais de {@code
 * preferred}, identifiants d'options et libellés seulement.
 */
public record ApplicationQuestionView(
        UUID id,
        String label,
        String type,
        boolean isRequired,
        int sortOrder,
        List<ApplicationQuestionOptionView> options) {
}
