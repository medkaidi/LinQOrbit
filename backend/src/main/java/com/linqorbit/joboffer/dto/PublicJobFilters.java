package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Recherche, filtres et tri facultatifs du job board public (T-77), tels que
 * reçus : le service les valide (absent, vide ou blanc ≡ pas de filtre).
 * {@code country} : code ISO 3166-1 alpha-2 ; {@code sort} : {@code recent}
 * (défaut) ou {@code expiringSoon}.
 */
public record PublicJobFilters(
        String q,
        UUID workModeId,
        UUID contractTypeId,
        UUID employmentTypeId,
        String seniority,
        String country,
        String sort) {

    /** Aucun filtre, tri par défaut. */
    public static PublicJobFilters none() {
        return new PublicJobFilters(null, null, null, null, null, null, null);
    }
}
