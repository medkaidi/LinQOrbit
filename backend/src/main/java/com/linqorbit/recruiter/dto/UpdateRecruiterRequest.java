package com.linqorbit.recruiter.dto;

import jakarta.validation.constraints.Size;

/**
 * Mise à jour du profil recruteur : headline et bio optionnels, null = inchangé,
 * chaîne vide = effacée (la conversion s'effectue dans le service).
 */
public record UpdateRecruiterRequest(
        @Size(max = 100, message = "must be at most 100 characters") String headline,
        @Size(max = 2000, message = "must be at most 2000 characters") String bio) {
}
