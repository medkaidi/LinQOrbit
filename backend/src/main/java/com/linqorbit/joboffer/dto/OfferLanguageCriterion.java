package com.linqorbit.joboffer.dto;

/**
 * Critère de langue stocké, tel que transmis au service IA : niveau en
 * texte libre côté entrée (CEFR côté sortie), caractère obligatoire inclus.
 */
public record OfferLanguageCriterion(
        String name,
        String level,
        Boolean isRequired) {
}
