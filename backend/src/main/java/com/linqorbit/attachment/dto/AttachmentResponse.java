package com.linqorbit.attachment.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * CV d'un candidat : métadonnées seules, le contenu passe par l'endpoint de
 * téléchargement. {@code current} marque le CV utilisé par les prochaines
 * candidatures.
 */
public record AttachmentResponse(
        UUID id,
        String originalName,
        String mimeType,
        long sizeBytes,
        String sha256,
        LocalDateTime createdAt,
        boolean current) {
}
