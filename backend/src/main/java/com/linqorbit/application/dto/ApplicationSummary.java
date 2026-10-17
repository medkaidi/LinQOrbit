package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Candidature existante du couple (candidat, offre) : signalée dans le
 * contexte pour que le formulaire bascule sur l'état « déjà candidaté » (une
 * seule candidature par couple, y compris après retrait — D49).
 */
public record ApplicationSummary(
        UUID id,
        String status,
        LocalDateTime createdAt) {
}
