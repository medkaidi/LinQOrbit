package com.linqorbit.common.pagination;

/**
 * Bornes de pagination (D34) : le backend décide toujours de la taille de
 * page — défaut {@value #DEFAULT_SIZE}, plafond {@value #MAX_SIZE}. Partagé
 * par les listes paginées (admin, listMine) pour une seule source de vérité.
 */
public final class PageSizes {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 50;

    private PageSizes() {
    }

    /** Taille effective : défaut si absente, bornée [1..{@value #MAX_SIZE}]. */
    public static int clamp(Integer size) {
        if (size == null) {
            return DEFAULT_SIZE;
        }
        return Math.min(Math.max(size, 1), MAX_SIZE);
    }

    /** Index de page 0-based : négatif ou absent → 0. */
    public static int page(Integer page) {
        return Math.max(page == null ? 0 : page, 0);
    }
}
