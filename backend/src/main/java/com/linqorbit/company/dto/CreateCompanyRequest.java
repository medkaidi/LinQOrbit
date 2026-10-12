package com.linqorbit.company.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Création de company (D11) : le recruteur créateur devient owner ; la
 * description est optionnelle.
 */
public record CreateCompanyRequest(
        @NotBlank(message = "must not be blank") @Size(max = 255, message = "must be at most 255 characters") String name,
        @Size(max = 2000, message = "must be at most 2000 characters") String description) {
}
