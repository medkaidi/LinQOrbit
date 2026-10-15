package com.linqorbit.admin.exception;

public class InvalidUserCapabilityFilterException extends RuntimeException {

    public InvalidUserCapabilityFilterException(String capability) {
        super("Filtre de capacité non supporté : " + capability);
    }
}
