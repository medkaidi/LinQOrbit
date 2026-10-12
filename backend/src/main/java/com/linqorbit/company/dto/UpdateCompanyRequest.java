package com.linqorbit.company.dto;

import jakarta.validation.constraints.Size;

/**
 * Mise à jour de company (owner seul, D12) : null = inchangé, chaîne vide =
 * effacé pour la description.
 */
public record UpdateCompanyRequest(
        @Size(max = 255, message = "must be at most 255 characters") String name,
        @Size(max = 2000, message = "must be at most 2000 characters") String description) {
}
