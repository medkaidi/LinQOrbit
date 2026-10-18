package com.linqorbit.matching.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * Matching refusé (règle A) : le statut accompagne un message sûr, affiché
 * tel quel par le frontend — 409 pour une précondition non remplie
 * (questions obligatoires, candidature transmise, fiche absente ou périmée).
 */
@Getter
public class InvalidMatchingException extends RuntimeException {

    private final HttpStatus status;

    public InvalidMatchingException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }
}
