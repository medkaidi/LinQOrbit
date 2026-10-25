package com.linqorbit.joboffer.exception;

import lombok.Getter;

/**
 * Valeur de filtre ou de tri non supportée sur une liste d'offres (statut,
 * séniorité, échéance, pays, tri) → 400. {@code filter} est le nom constant du
 * paramètre : le message d'API ne reprend jamais la valeur saisie.
 */
@Getter
public class InvalidJobOfferFilterException extends RuntimeException {

    private final String filter;

    public InvalidJobOfferFilterException(String filter, String value) {
        super("Filtre d'offres non supporté : " + filter + "=" + value);
        this.filter = filter;
    }
}
