package com.linqorbit.candidate.exception;

/**
 * Validation d'un profil qui n'existe pas encore (aucune écriture de section) :
 * rien à normaliser. Statut 409 construit par le handler dédié (Règle A).
 */
public class EmptyProfileException extends RuntimeException {

    public EmptyProfileException() {
        super("Candidate profile has no content to validate");
    }
}
