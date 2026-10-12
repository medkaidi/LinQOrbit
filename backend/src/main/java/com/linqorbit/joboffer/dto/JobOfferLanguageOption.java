package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Langue exigée par une offre vue dans une réponse : niveau CECR, caractère
 * obligatoire, symbole et nom de la langue (résolus depuis le vocabulaire
 * pour l'affichage).
 */
public record JobOfferLanguageOption(
        UUID languageId,
        String symbol,
        String name,
        String level,
        boolean isRequired) {
}
