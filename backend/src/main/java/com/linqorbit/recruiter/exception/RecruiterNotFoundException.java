package com.linqorbit.recruiter.exception;

/**
 * Action réclamant un profil recruteur (ligne {@code recruiters}) alors que le
 * compte n'en a pas encore — le frontend déclenche alors l'onboarding (D16).
 * Statut 404 construit par le handler dédié (Règle A).
 */
public class RecruiterNotFoundException extends RuntimeException {

    public RecruiterNotFoundException() {
        super("No recruiter profile for this account");
    }
}
