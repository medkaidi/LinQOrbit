package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Carte de la liste recruteur : identité minimale, statut, date de
 * transmission, cinq scores de section et signal de contestation. Aucun
 * agrégat global.
 */
public record RecruiterApplicationCard(
        UUID id,
        RecruiterCandidateSummary candidate,
        String status,
        LocalDateTime submittedAt,
        boolean assessmentAvailable,
        List<RecruiterSectionScore> sections,
        int contestedCount,
        Double averageGap) {
}
