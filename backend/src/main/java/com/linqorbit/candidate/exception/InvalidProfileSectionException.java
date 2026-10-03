package com.linqorbit.candidate.exception;

public class InvalidProfileSectionException extends RuntimeException {

    public InvalidProfileSectionException(String reason) {
        super(reason);
    }
}
