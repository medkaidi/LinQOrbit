package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Suggestion de compétence en file de revue : nom proposé + auteur (compte
 * candidat partageant l'UUID du compte).
 */
public record AdminSkillSuggestionResponse(
        UUID id,
        String name,
        UUID candidateId,
        String candidateFirstName,
        String candidateLastName,
        String candidateEmail,
        LocalDateTime createdAt) {
}
