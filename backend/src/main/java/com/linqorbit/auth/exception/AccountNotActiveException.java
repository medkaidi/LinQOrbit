package com.linqorbit.auth.exception;

public class AccountNotActiveException extends RuntimeException {

    public AccountNotActiveException() {
        super("Ce compte n'est pas actif");
    }
}
