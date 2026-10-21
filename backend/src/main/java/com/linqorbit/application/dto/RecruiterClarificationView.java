package com.linqorbit.application.dto;

import java.util.UUID;

/** Paire question/réponse de clarification IA, dans l'ordre où elle a été posée. */
public record RecruiterClarificationView(
        UUID id,
        String question,
        String rationale,
        String answer,
        String status) {
}
