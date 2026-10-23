package com.linqorbit.admin.exception;

/**
 * Revue interne rejetée pour une entrée invalide (verdict inconnu, champ hors
 * bornes, correction incohérente). Le message est affichable tel quel.
 */
public class InvalidCriterionReportReviewException extends RuntimeException {

    public InvalidCriterionReportReviewException(String message) {
        super(message);
    }
}
