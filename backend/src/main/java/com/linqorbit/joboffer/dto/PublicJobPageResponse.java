package com.linqorbit.joboffer.dto;

import java.util.List;

/**
 * Page du job board public (T-72) : même enveloppe stable que les autres
 * listes paginées (D34 — {@code items, page, size, total}), {@code size}
 * étant la valeur effective appliquée par le backend (défaut 20, clamp 50).
 */
public record PublicJobPageResponse(
        List<PublicJobListItem> items,
        int page,
        int size,
        long total) {
}
