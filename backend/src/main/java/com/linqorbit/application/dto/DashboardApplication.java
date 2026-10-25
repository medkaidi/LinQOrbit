package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Ligne « dernières candidatures » du tableau de bord : statut, dates et offre,
 * sans les réponses ni le CV (la liste complète reste {@code GET /applications/mine}).
 */
public record DashboardApplication(
        UUID id,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ApplicationJobSummary job) {
}
