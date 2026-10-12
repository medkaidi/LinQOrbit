package com.linqorbit.company.exception;

/**
 * Action réservée à l'owner tentée par un simple membre (D12 : rôle coarse
 * owner/member). Statut 403 construit par le handler dédié (Règle A).
 */
public class CompanyAccessDeniedException extends RuntimeException {

    public CompanyAccessDeniedException() {
        super("Only the company owner can perform this action");
    }
}
