package com.linqorbit.attachment.exception;

import org.springframework.http.HttpStatus;

/**
 * Dépôt d'une pièce jointe rejeté (fichier vide, type non supporté, nom trop
 * long). Porte le statut HTTP que le contrôleur doit renvoyer — miroir de
 * {@code AiServiceException} pour l'import de CV.
 */
public class InvalidAttachmentException extends RuntimeException {

    private final HttpStatus status;

    public InvalidAttachmentException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
