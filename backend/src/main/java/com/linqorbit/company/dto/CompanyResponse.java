package com.linqorbit.company.dto;

import java.util.UUID;

/**
 * Company vue par un membre : {@code isOwner} porte le rôle coarse (D12) — le
 * frontend s'en sert pour afficher ou masquer les actions réservées à l'owner.
 */
public record CompanyResponse(
        UUID id,
        String name,
        String description,
        boolean isOwner) {
}
