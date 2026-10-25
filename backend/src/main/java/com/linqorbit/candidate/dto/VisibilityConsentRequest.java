package com.linqorbit.candidate.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Accord ou retrait du consentement à la visibilité du profil par les
 * recruteurs (T-102, D86). Un booléen seul : la date et la version du texte
 * sont posées par le serveur, jamais par le client.
 */
public record VisibilityConsentRequest(@NotNull Boolean consent) {
}
