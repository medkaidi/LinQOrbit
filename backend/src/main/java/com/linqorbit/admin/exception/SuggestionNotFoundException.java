package com.linqorbit.admin.exception;

import java.util.UUID;

public class SuggestionNotFoundException extends RuntimeException {

    public SuggestionNotFoundException(UUID suggestionId) {
        super("Suggestion introuvable : " + suggestionId);
    }
}
