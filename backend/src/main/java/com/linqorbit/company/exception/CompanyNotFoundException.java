package com.linqorbit.company.exception;

/**
 * Action sur une company inconnue <em>ou</em> à laquelle le compte n'appartient
 * pas : un 404 unique évite de révéler l'existence d'une company à un
 * étranger. Statut 404 construit par le handler dédié (Règle A).
 */
public class CompanyNotFoundException extends RuntimeException {

    public CompanyNotFoundException() {
        super("Company not found for this account");
    }
}
