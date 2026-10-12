package com.linqorbit.joboffer.exception;

import com.linqorbit.joboffer.entity.JobOfferStatus;

/**
 * Transition de statut illégale (D13) : la cible n'est pas autorisée depuis
 * le statut courant (ex. publish depuis DRAFT).
 */
public class InvalidJobOfferStatusException extends RuntimeException {

    public InvalidJobOfferStatusException(JobOfferStatus current, String action) {
        super("Cannot " + action + " a job offer in status " + current.getApiValue());
    }

    public InvalidJobOfferStatusException(String message) {
        super(message);
    }
}
