package com.linqorbit.application.dto;

import java.util.UUID;

/**
 * Réponse reconstruite (D48) : {@code value} suit le type — TEXTE → String,
 * NOMBRE → nombre, OUI_NON → booléen, CHOIX_UNIQUE → {@link
 * ApplicationAnswerOptionView}, CHOIX_MULTIPLE → liste de vues d'options.
 * Jamais de {@code preferred} (information recruteur seule).
 */
public record ApplicationAnswerView(
        UUID questionId,
        String label,
        String type,
        Object value) {
}
