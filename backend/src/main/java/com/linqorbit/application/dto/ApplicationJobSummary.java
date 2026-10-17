package com.linqorbit.application.dto;

/**
 * Résumé d'offre porté par une candidature : de quoi afficher la ligne et
 * pointer vers la fiche publique (/jobs/{publicId}-{slug}).
 */
public record ApplicationJobSummary(
        String publicId,
        String slug,
        String title,
        String companyName) {
}
