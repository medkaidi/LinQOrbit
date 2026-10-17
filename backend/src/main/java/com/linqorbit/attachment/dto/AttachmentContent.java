package com.linqorbit.attachment.dto;

import org.springframework.core.io.Resource;

/**
 * Contenu binaire d'une pièce jointe pour le streaming HTTP : métadonnées
 * (en-têtes Content-Type / Content-Disposition) et ressource disque.
 */
public record AttachmentContent(AttachmentResponse attachment, Resource resource) {
}
