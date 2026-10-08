package com.linqorbit.admin.exception;

public class InvalidUserStatusException extends RuntimeException {

    public InvalidUserStatusException(Object status) {
        super("Statut non supporté : " + status);
    }
}
