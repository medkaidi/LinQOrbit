package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Candidature du candidat connecté (D48/D49) : statut, CV épinglé et réponses
 * reconstruites dans l'ordre des questions de l'offre
 * ({@code [{questionId, label, type, value}]}). {@code preferred} n'apparaît
 * jamais côté candidat — information recruteur seule.
 */
public record ApplicationResponse(
        UUID id,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ApplicationJobSummary job,
        ApplicationCvSummary cv,
        List<ApplicationAnswerView> answers) {
}
