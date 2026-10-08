package com.linqorbit.admin.exception;

import java.util.UUID;

public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(UUID userId) {
        super("Compte introuvable : " + userId);
    }
}
