package com.linqorbit.application.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Candidature du couple (candidat, offre), brouillon compris : signalée dans
 * le contexte pour que le parcours reprenne le brouillon ou bascule sur
 * l'état « déjà candidaté » (une seule candidature par couple, y compris
 * après retrait — D49). {@code cvAttachmentId} = CV renseigné (nul pour un
 * brouillon sans CV).
 */
public record ApplicationSummary(
        UUID id,
        String status,
        UUID cvAttachmentId,
        LocalDateTime createdAt) {
}
