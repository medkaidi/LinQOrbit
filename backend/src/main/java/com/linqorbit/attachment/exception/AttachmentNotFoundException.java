package com.linqorbit.attachment.exception;

public class AttachmentNotFoundException extends RuntimeException {

    public AttachmentNotFoundException(String reason) {
        super(reason);
    }
}
