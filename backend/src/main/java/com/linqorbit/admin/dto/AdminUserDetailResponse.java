package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Fiche de consultation d'un compte côté administration : identité complète
 * saisie par l'utilisateur (localisation, téléphone, sexe — jamais le hash du
 * mot de passe), statut, rôles de capacité et drapeaux d'identité
 * (candidat / recruteur) pour orienter la suite de la consultation.
 */
public record AdminUserDetailResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String status,
        List<Short> roles,
        String phone,
        String sex,
        String homeCountry,
        String currentCity,
        String currentCountry,
        LocalDateTime createdAt,
        boolean hasCandidateProfile,
        boolean hasRecruiterProfile) {
}
