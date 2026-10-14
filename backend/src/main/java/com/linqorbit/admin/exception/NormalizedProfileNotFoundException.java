package com.linqorbit.admin.exception;

public class NormalizedProfileNotFoundException extends RuntimeException {

    public NormalizedProfileNotFoundException(boolean candidateSource) {
        super(candidateSource
                ? "Aucune fiche normalisée pour ce compte."
                : "Aucune fiche normalisée pour cette offre.");
    }
}
