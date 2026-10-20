package com.linqorbit.candidate.dto;

/**
 * Événement SSE « status » de la normalisation (D64) : un signal seulement —
 * {@code pending}, {@code running}, {@code done}, {@code failed}, ou
 * {@code none} sans aucune validation. Le profil ou l'offre se relit par son
 * GET, seule source de vérité.
 */
public record NormalizationStatusEvent(String status) {
}
