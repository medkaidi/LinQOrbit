package com.linqorbit.invitation.exception;

import org.springframework.http.HttpStatus;

/**
 * Opération sur un candidat suggéré ou une invitation rejetée (suggestion
 * inconnue, offre fermée, déjà invité, déjà candidaté…). Porte le statut HTTP
 * à renvoyer — miroir de {@code InvalidApplicationException}. Le message est
 * affichable tel quel (jamais de message brut de framework).
 */
public class InvalidInvitationException extends RuntimeException {

    private final HttpStatus status;

    public InvalidInvitationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
