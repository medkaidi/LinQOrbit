package com.linqorbit.joboffer.dto;

import java.util.UUID;

/**
 * Filtres facultatifs de la liste des offres du recruteur (T-70), tels que
 * reçus : le service les valide (absent, vide ou blanc ≡ pas de filtre).
 * {@code expiry} : {@code expired} ou {@code expiringSoon} (≤ 30 jours).
 */
public record JobOfferListFilters(
        String q,
        String status,
        UUID workModeId,
        UUID contractTypeId,
        UUID employmentTypeId,
        String seniority,
        UUID companyId,
        String expiry) {

    /** Aucun filtre. */
    public static JobOfferListFilters none() {
        return new JobOfferListFilters(null, null, null, null, null, null, null, null);
    }
}
