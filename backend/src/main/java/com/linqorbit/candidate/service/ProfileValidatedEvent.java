package com.linqorbit.candidate.service;

import java.util.UUID;

/**
 * Publié quand une validation de profil a créé un job de normalisation.
 * Consommé <b>après commit</b> uniquement ({@code TransactionPhase.AFTER_COMMIT}) :
 * un rollback ne déclenche jamais d'exécution, et le thread exécutant ne voit
 * que l'état durable du job.
 */
public record ProfileValidatedEvent(UUID jobId) {
}
