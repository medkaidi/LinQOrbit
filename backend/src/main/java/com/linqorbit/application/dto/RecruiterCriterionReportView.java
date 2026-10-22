package com.linqorbit.application.dto;

import java.time.LocalDateTime;

/**
 * Signalement interne d'une évaluation IA posé par le lecteur courant
 * (T-86, D66) : motif, commentaire facultatif et date. Le détail n'expose
 * que les signalements de son auteur — un signalement est un retour qualité
 * privé, jamais une donnée partagée.
 */
public record RecruiterCriterionReportView(
        String criterionKey,
        String reason,
        String comment,
        LocalDateTime createdAt) {
}
