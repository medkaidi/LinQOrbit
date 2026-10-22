package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Détail d'une candidature transmise, décidée ou rejetée — jamais un brouillon.
 *
 * @param averageGap écart moyen absolu entre la note IA et la note propre du
 *                   candidat, calculé par le serveur comme sur la carte de
 *                   liste (`null` sans contestation exploitable) — jamais
 *                   déduit côté client.
 * @param criterionReports signalements internes de l'évaluation IA posés par
 *                   le lecteur courant (T-86, D66) — jamais ceux des autres.
 */
public record RecruiterApplicationDetail(
        UUID id,
        RecruiterCandidateSummary candidate,
        String status,
        LocalDateTime submittedAt,
        boolean canDecide,
        RecruiterJobSummary job,
        List<RecruiterAnswerView> answers,
        RecruiterAssessmentView assessment,
        List<RecruiterClarificationView> clarifications,
        List<RecruiterContestationView> contests,
        Double averageGap,
        List<RecruiterCriterionReportView> criterionReports,
        RecruiterCvSummary cv) {
}
