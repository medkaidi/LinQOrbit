package com.linqorbit.auth;

public class EmailAlreadyExistsException extends RuntimeException {

    public EmailAlreadyExistsException(String email) {
        super("Un compte existe déjà pour cet email : " + email);
    }
}
