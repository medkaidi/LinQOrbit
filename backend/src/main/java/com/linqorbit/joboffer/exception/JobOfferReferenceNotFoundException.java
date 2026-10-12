package com.linqorbit.joboffer.exception;

/**
 * Référence de vocabulaire inconnue dans une offre (D14) : identifiant de
 * compétence, langue, diplôme, domaine d'étude ou vocabulaire d'offre
 * inexistant.
 */
public class JobOfferReferenceNotFoundException extends RuntimeException {

    public JobOfferReferenceNotFoundException(String resource, Object id) {
        super("Unknown " + resource + ": " + id);
    }
}
