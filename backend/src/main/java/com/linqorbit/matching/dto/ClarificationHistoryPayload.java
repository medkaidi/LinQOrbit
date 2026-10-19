package com.linqorbit.matching.dto;

/**
 * Clarification déjà fermée, rejouée au service IA (D58 : sans état) :
 * question, pourquoi elle a été posée, réponse du candidat ({@code null}
 * pour un skip) et statut {@code answered} | {@code skipped}.
 */
public record ClarificationHistoryPayload(
        String question,
        String rationale,
        String answer,
        String status) {
}
