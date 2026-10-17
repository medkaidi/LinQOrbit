package com.linqorbit.application.exception;

import org.springframework.http.HttpStatus;

/**
 * Opération de candidature rejetée (soumission invalide, doublon de couple,
 * CV manquant, offre plus disponible…). Porte le statut HTTP que le
 * contrôleur doit renvoyer — miroir de {@code InvalidAttachmentException}.
 * Le message est affichable tel quel (règle : jamais de message brut de
 * framework dans {@code detail}).
 */
public class InvalidApplicationException extends RuntimeException {

    private final HttpStatus status;

    public InvalidApplicationException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
