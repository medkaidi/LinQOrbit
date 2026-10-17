package com.linqorbit.application.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Réponse à une question de présélection (D48) : exactement un des porteurs
 * selon le type de la question — {@code text} (TEXTE), {@code number}
 * (NOMBRE), {@code booleanValue} (OUI_NON), {@code optionIds} (choix unique =
 * 1, choix multiple ≥ 1). La cohérence type/porteur est validée en service
 * (la base ne lit pas question_type). {@code optionIds} est facultatif
 * (absent ≡ vide).
 */
public record ApplicationAnswerRequest(
        UUID questionId,
        String text,
        BigDecimal number,
        Boolean booleanValue,
        List<UUID> optionIds) {

    public ApplicationAnswerRequest {
        optionIds = optionIds == null ? List.of() : optionIds;
    }
}
