package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Signalement interne d'une évaluation IA, lu par la console d'administration
 * (T-86, D66) : le critère signalé (résolu dans le résultat épinglé),
 * l'offre et la company concernées, le candidat, l'auteur, le motif et le
 * commentaire.
 *
 * <p>Le libellé du critère, sa section et ses scores sont relus dans le JSON
 * du résultat épinglé : rien n'est dénormalisé, la lecture suit l'évaluation
 * affichée au recruteur.</p>
 */
public record AdminCriterionReportResponse(
        UUID id,
        String criterionKey,
        String criterionLabel,
        /** Clé de section (camelCase) ; absente si la section n'est pas résolue. */
        String section,
        /** Score du critère ; {@code null} si le critère n'est pas résolu. */
        Integer score,
        /** Score de la section ; {@code null} si absent ou critère non résolu. */
        Double sectionScore,
        String reason,
        String comment,
        LocalDateTime createdAt,
        String authorFirstName,
        String authorLastName,
        String authorEmail,
        String candidateFirstName,
        String candidateLastName,
        UUID offerId,
        String offerTitle,
        String companyName,
        /**
         * Avis de <b>l'admin courant</b> sur ce signalement (T-99) :
         * {@code upheld}, {@code notUpheld} ou {@code null} (aucun avis —
         * « Pending » côté UI). Jamais l'avis d'un autre admin, jamais un
         * compteur ou un statut global.
         */
        String myReviewVerdict) {
}
