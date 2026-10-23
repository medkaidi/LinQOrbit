package com.linqorbit.admin.exception;

/**
 * Revue interne en conflit avec l'état existant : l'admin a déjà donné son
 * avis final, ou il est l'auteur du signalement. Le message est affichable tel
 * quel.
 */
public class CriterionReportReviewConflictException extends RuntimeException {

    public CriterionReportReviewConflictException(String message) {
        super(message);
    }
}
