package com.linqorbit.joboffer.dto;

/**
 * Entreprise recruteuse dans le snapshot : nom + présentation (source du
 * companyPitch, transmise verbatim au service IA).
 */
public record OfferCompanySnapshot(
        String name,
        String description) {
}
