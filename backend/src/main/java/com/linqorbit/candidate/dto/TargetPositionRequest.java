package com.linqorbit.candidate.dto;

import jakarta.validation.constraints.Size;

/**
 * Poste recherché, isolé du bloc About (PUT /about ne l'écrit jamais) :
 * la carte identité le sauvegarde via sa propre endpoint.
 * Valeur nulle ou vide = efface le poste recherché.
 */
public record TargetPositionRequest(
        @Size(max = 255) String targetPosition) {
}
