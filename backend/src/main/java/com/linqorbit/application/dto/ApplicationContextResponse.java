package com.linqorbit.application.dto;

import java.util.List;
import java.util.UUID;

/**
 * Contexte de candidature d'une offre publiée : le récapitulatif d'offre, les
 * questions de présélection SANS {@code preferred} (information recruteur
 * seule — la fiche candidat ne le voit jamais), le CV courant éventuel (pour
 * pré-sélection) et la candidature existante éventuelle du couple.
 */
public record ApplicationContextResponse(
        ApplicationJobSummary job,
        List<ApplicationQuestionView> questions,
        UUID currentCvAttachmentId,
        ApplicationSummary existingApplication) {
}
