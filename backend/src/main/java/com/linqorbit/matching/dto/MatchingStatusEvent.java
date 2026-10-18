package com.linqorbit.matching.dto;

/**
 * Événement SSE « status » du matching (D60) : un signal seulement — le
 * résultat complet se relit par la lecture du matching courant.
 */
public record MatchingStatusEvent(String matchingId, String status) {
}
