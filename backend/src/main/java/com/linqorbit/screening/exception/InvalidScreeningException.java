package com.linqorbit.screening.exception;

import org.springframework.http.HttpStatus;

/**
 * Opération sur le screening d'une offre rejetée (relance d'un job qui n'a pas
 * échoué, offre plus publiée…). Porte le statut HTTP à renvoyer — miroir de
 * {@code InvalidApplicationException}. Le message est affichable tel quel.
 */
public class InvalidScreeningException extends RuntimeException {

    private final HttpStatus status;

    public InvalidScreeningException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
