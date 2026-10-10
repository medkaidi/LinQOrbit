package com.linqorbit.candidate.dto;

/**
 * Localisation du candidat, lue depuis la ligne users (PK partagée) au moment
 * du snapshot — le profil public n'expose pas ces champs ; ils n'existent que
 * dans le corps de normalisation. Nulls tolérés (champs facultatifs du compte).
 */
public record ProfileLocation(
        String currentCity,
        String currentCountry) {
}
