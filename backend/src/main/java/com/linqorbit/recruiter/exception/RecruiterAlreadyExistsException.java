package com.linqorbit.recruiter.exception;

/**
 * Tentative de création d'un profil recruteur pour un compte qui en a déjà un
 * (POST /api/v1/recruiters/me rejoué). Statut 409 construit par le handler
 * dédié (Règle A).
 */
public class RecruiterAlreadyExistsException extends RuntimeException {

    public RecruiterAlreadyExistsException() {
        super("Recruiter profile already exists for this account");
    }
}
