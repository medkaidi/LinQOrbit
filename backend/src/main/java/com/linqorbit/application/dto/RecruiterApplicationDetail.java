package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Détail d'une candidature transmise, décidée ou rejetée — jamais un brouillon. */
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
        RecruiterCvSummary cv) {
}
