package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Signalement interne d'une évaluation IA, lu par la console d'administration
 * (T-86, D66) : le critère signalé (résolu dans le résultat épinglé),
 * l'offre et la company concernées, le candidat, l'auteur, le motif et le
 * commentaire.
 *
 * <p>Le libellé du critère et sa section sont relus dans le JSON du résultat
 * épinglé : rien n'est dénormalisé, la lecture suit l'évaluation affichée au
 * recruteur.</p>
 */
public record AdminCriterionReportResponse(
        UUID id,
        String criterionKey,
        String criterionLabel,
        /** Clé de section (camelCase) ; absente si la section n'est pas résolue. */
        String section,
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
        String companyName) {
}
