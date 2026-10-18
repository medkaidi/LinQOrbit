package com.linqorbit.application.dto;

import java.util.UUID;

/**
 * CV de la candidature (épinglé à la transmission, D59) : identifiant du CV et nom d'origine (le
 * fichier reste téléchargeable par son propriétaire via les pièces jointes).
 */
public record ApplicationCvSummary(
        UUID attachmentId,
        String originalName) {
}
