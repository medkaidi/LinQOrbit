package com.linqorbit.admin.dto;

import java.util.List;
import java.util.UUID;

/**
 * Compte visible côté administration : identité, statut, rôles de capacité
 * (codes SMALLINT, même format que le claim JWT « roles ») et drapeaux
 * d'identité (profil candidat / recruteur) pour les cartes de la liste.
 */
public record AdminUserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String status,
        List<Short> roles,
        boolean hasCandidateProfile,
        boolean hasRecruiterProfile) {
}
