package com.linqorbit.candidate.exception;

/**
 * Consentement impossible à enregistrer : le candidat n'a pas encore de profil
 * (aucune ligne candidates). Message affichable tel quel (409).
 */
public class VisibilityConsentException extends RuntimeException {

    public VisibilityConsentException(String message) {
        super(message);
    }
}
