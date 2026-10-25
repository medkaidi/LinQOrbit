package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Carte de la liste recruteur : identité minimale, statut, date de
 * transmission, repères du candidat (séniorité, années, pays, compétences),
 * cinq scores de section et signal de contestation (compteur, sections
 * contestées, écart moyen). Aucun agrégat global.
 */
public record RecruiterApplicationCard(
        UUID id,
        RecruiterCandidateSummary candidate,
        RecruiterCandidateHighlights highlights,
        String status,
        LocalDateTime submittedAt,
        boolean assessmentAvailable,
        List<RecruiterSectionScore> sections,
        int contestedCount,
        List<RecruiterContestedSection> contestedSections,
        Double averageGap) {
}
