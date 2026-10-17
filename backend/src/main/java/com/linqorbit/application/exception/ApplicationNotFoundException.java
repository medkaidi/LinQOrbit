package com.linqorbit.application.exception;

/**
 * Candidature inconnue pour le candidat connecté (l'identifiant d'un autre
 * candidat est introuvable — même 404, aucune fuite d'existence).
 */
public class ApplicationNotFoundException extends RuntimeException {

    public ApplicationNotFoundException(String reason) {
        super(reason);
    }
}
