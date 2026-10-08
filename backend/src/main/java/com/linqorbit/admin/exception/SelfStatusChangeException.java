package com.linqorbit.admin.exception;

public class SelfStatusChangeException extends RuntimeException {

    public SelfStatusChangeException() {
        super("Un administrateur ne peut pas modifier son propre statut");
    }
}
