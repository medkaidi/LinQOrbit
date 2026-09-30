package com.linqorbit.auth;

public class AccountNotActiveException extends RuntimeException {

    public AccountNotActiveException() {
        super("Ce compte n'est pas actif");
    }
}
