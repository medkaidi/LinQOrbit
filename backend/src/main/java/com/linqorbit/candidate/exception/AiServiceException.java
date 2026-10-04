package com.linqorbit.candidate.exception;

import org.springframework.http.HttpStatus;

/**
 * Échec de l'appel au service IA. Porte le statut HTTP que le contrôleur doit
 * renvoyer (traduit depuis la réponse du service IA ou de la couche réseau).
 */
public class AiServiceException extends RuntimeException {

    private final HttpStatus status;

    public AiServiceException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
