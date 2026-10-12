package com.linqorbit.recruiter.dto;

import java.util.UUID;

/**
 * Profil recruteur (headline et bio optionnels). Ne porte jamais l'identité
 * nominative : nom, photo et e-mail restent sur GET /api/v1/auth/me.
 */
public record RecruiterResponse(
        UUID id,
        String headline,
        String bio) {
}
