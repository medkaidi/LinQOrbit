package com.linqorbit.joboffer.exception;

import java.util.UUID;

/**
 * Offre inconnue ou inaccessible : l'offre n'existe pas, ou le recruteur
 * connecté n'est membre d'aucune company la possédant (D11/D12). Un même
 * détail évite d'énumérer les offres existantes.
 */
public class JobOfferNotFoundException extends RuntimeException {

    public JobOfferNotFoundException(UUID id) {
        super("Job offer not found: " + id);
    }

    public JobOfferNotFoundException(String message) {
        super(message);
    }
}
