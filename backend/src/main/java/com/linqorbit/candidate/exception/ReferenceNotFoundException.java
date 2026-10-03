package com.linqorbit.candidate.exception;

import java.util.UUID;

public class ReferenceNotFoundException extends RuntimeException {

    public ReferenceNotFoundException(String reference, UUID id) {
        super(reference + " inconnu : " + id);
    }
}
