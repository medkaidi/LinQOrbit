package com.linqorbit.admin.dto;

import java.util.List;

/**
 * Page de la liste globale des offres : enveloppe stable (pas de type Page de
 * Spring dans le JSON) — {@code page} 0-based, {@code total} = nombre total
 * d'offres pour le filtre courant.
 */
public record AdminJobOfferPageResponse(
        List<AdminJobOfferListItem> items,
        int page,
        int size,
        long total) {
}
