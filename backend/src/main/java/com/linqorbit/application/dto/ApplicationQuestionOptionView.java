package com.linqorbit.application.dto;

import java.util.UUID;

/**
 * Option d'une question de choix, vue candidat : un sélecteur à cocher — rien
 * d'autre que l'identifiant et le libellé (jamais {@code preferred}).
 */
public record ApplicationQuestionOptionView(
        UUID id,
        String label,
        int sortOrder) {
}
