package com.linqorbit.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Contexte du parcours de candidature d'une offre publiée (D59) : le
 * récapitulatif d'offre, les questions du recruteur SANS {@code preferred}
 * (information recruteur seule), le CV courant éventuel, la candidature du
 * couple (brouillon ou transmise) avec ses réponses, l'<b>étape calculée</b>
 * par le serveur ({@code recruiter_questions}, {@code matching},
 * {@code submitted} — jamais stockée) et {@code canSubmit} (brouillon dont
 * toutes les questions obligatoires sont répondues). {@code assessment} :
 * avancement de l'évaluation IA (clarifications, contestation) du couple.
 */
public record ApplicationContextResponse(
        ApplicationJobSummary job,
        List<ApplicationQuestionView> questions,
        UUID currentCvAttachmentId,
        ApplicationSummary existingApplication,
        List<ApplicationAnswerView> answers,
        String step,
        boolean canSubmit,
        ApplicationAssessmentView assessment) {
}
