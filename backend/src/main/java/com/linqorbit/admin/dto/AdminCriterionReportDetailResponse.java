package com.linqorbit.admin.dto;

import java.util.List;
import java.util.UUID;

import com.linqorbit.application.dto.RecruiterAssessmentView;
import com.linqorbit.application.dto.RecruiterContestationView;

/**
 * Dossier d'un signalement interne d'évaluation IA (T-86, D66) : le
 * signalement, le critère tel qu'il a été noté (résultat épinglé), l'évaluation
 * complète en lecture seule et les contestations du candidat, avec l'écart
 * moyen calculé par le serveur.
 *
 * @param report         signalement (offre, candidate, auteur, motif, date)
 * @param candidateUserId compte du candidat, pour ouvrir son profil dans la console
 * @param criterion      critère signalé relu dans le résultat épinglé
 * @param assessment     évaluation complète, même forme que la vue recruteur
 * @param contests       contestations du candidat (critère signalé compris)
 * @param averageGap     écart moyen absolu, même mesure que la vue recruteur
 * @param canReview      true si l'admin courant peut déposer un avis : il n'a
 *                       pas déjà revu ce signalement et n'en est pas l'auteur
 *                       (auto-review interdite) — le serveur décide, l'UI ne
 *                       déduit rien
 * @param myReview       avis final de l'admin courant, ou {@code null} s'il
 *                       n'a pas encore donné son avis — jamais les avis des
 *                       autres, ni leur nombre, ni leur existence
 */
public record AdminCriterionReportDetailResponse(
        AdminCriterionReportResponse report,
        UUID candidateUserId,
        AdminCriterionContextResponse criterion,
        RecruiterAssessmentView assessment,
        List<RecruiterContestationView> contests,
        Double averageGap,
        boolean canReview,
        AdminCriterionReportReviewResponse myReview) {
}
