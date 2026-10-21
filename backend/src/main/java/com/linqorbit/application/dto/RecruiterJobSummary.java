package com.linqorbit.application.dto;

import java.util.UUID;

/** Offre contexte de la vue recruteur : titre, statut et lien public. */
public record RecruiterJobSummary(
        UUID id,
        String publicId,
        String slug,
        String title,
        String status,
        String companyName) {
}
