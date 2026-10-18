package com.linqorbit.matching.exception;

/**
 * Aucun matching pour le couple et la fiche courante du candidat (404 au
 * détail constant — la raison technique part en logs).
 */
public class MatchingNotFoundException extends RuntimeException {

    public MatchingNotFoundException(String reason) {
        super(reason);
    }
}
