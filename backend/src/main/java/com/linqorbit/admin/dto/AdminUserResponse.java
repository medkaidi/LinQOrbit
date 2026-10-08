package com.linqorbit.admin.dto;

import java.util.List;
import java.util.UUID;

/**
 * Compte visible côté administration : identité, statut et rôles de capacité
 * (codes SMALLINT, même format que le claim JWT « roles »).
 */
public record AdminUserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String status,
        List<Short> roles) {
}
