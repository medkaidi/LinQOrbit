package com.linqorbit.application.dto;

import java.util.UUID;

/**
 * Transmission d'un brouillon (D59) : {@code cvAttachmentId} est facultatif —
 * absent, le CV du brouillon (sinon le CV courant) est épinglé ; présent, il
 * doit appartenir au candidat (les anciens CV restent candidats au choix).
 * Le corps entier est facultatif (absent ≡ aucun choix).
 */
public record SubmitApplicationRequest(UUID cvAttachmentId) {
}
