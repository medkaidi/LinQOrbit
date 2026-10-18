package com.linqorbit.matching.service;

import java.util.UUID;

/**
 * Publié par {@code MatchingService} après l'INSERT d'un job : le worker le
 * consomme après commit et lance l'analyse immédiatement (aucun polling).
 */
public record MatchingRequestedEvent(UUID jobId) {
}
