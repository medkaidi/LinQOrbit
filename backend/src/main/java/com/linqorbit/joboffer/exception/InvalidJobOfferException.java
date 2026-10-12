package com.linqorbit.joboffer.exception;

/**
 * Demande d'offre invalide côté métier (400) : règles non couvertes par les
 * annotations Bean Validation (ex. salaryMin > salaryMax).
 */
public class InvalidJobOfferException extends RuntimeException {

    public InvalidJobOfferException(String message) {
        super(message);
    }
}
