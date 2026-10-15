package com.linqorbit.admin.dto;

import java.util.List;

/**
 * Page de la liste des comptes : même enveloppe stable que les listes
 * d'offres ({@code items, page, size, total}) — {@code size} est la valeur
 * effective appliquée par le backend (défaut 20, clamp 50, D34).
 */
public record AdminUserPageResponse(
        List<AdminUserResponse> items,
        int page,
        int size,
        long total) {
}
