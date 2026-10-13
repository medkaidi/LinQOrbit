package com.linqorbit.joboffer.dto;

import com.linqorbit.candidate.dto.ParseContext;

/**
 * Corps JSON envoyé au service IA pour la normalisation d'offre : le
 * snapshot de l'offre stockée (libellés résolus, description en texte brut)
 * + le contexte de référence (vérité DB). Champs en camelCase natif : le
 * service IA accepte les deux casses.
 */
public record OfferNormalizeRequest(
        OfferSnapshot offer,
        ParseContext context) {
}
