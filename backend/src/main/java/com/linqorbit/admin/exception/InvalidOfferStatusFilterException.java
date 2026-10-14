package com.linqorbit.admin.exception;

public class InvalidOfferStatusFilterException extends RuntimeException {

    public InvalidOfferStatusFilterException(String status) {
        super("Filtre de statut d'offre non supporté : " + status);
    }
}
