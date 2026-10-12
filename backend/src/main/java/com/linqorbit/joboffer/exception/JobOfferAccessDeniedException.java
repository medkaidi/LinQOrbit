package com.linqorbit.joboffer.exception;

import java.util.UUID;

/**
 * Membre d'une company sans droits d'écriture sur l'offre (D12) : seule la
 * company owner ou le recruteur créateur de l'offre (recruiter_id) gèrent
 * l'offre.
 */
public class JobOfferAccessDeniedException extends RuntimeException {

    public JobOfferAccessDeniedException(UUID offerId, UUID recruiterId) {
        super("Recruiter " + recruiterId + " cannot manage job offer " + offerId);
    }
}
