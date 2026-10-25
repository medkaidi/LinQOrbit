package com.linqorbit.screening.dto;

import java.util.UUID;

/**
 * Un candidat retenu par le screening : sa fiche courante (celle dont le
 * vecteur a été comparé) et la distance cosinus à la fiche de l'offre
 * ({@code 0} = identique, {@code 2} = opposé). Un signal de retrieval,
 * jamais un score de matching (D31) : il ne classe que pour couper le Top N.
 */
public record ScreenedCandidate(UUID candidateId, UUID normalizedProfileId, double distance) {
}
