package com.linqorbit.joboffer.dto;

import java.util.List;

/**
 * Page de la liste des offres d'un recruteur (D34) : même enveloppe stable
 * que la liste admin ({@code items, page, size, total}) — {@code size} est
 * la valeur effective appliquée par le backend (défaut 20, clamp 50).
 */
public record JobOfferPageResponse(
        List<JobOfferResponse> items,
        int page,
        int size,
        long total) {
}
