package com.linqorbit.application.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Réponse aux questions du recruteur dans le détail : la valeur typée et, pour
 * les choix, les options sélectionnées avec leur indicateur {@code preferred}.
 */
public record RecruiterAnswerView(
        UUID questionId,
        String label,
        String type,
        boolean required,
        String text,
        BigDecimal number,
        Boolean booleanValue,
        List<RecruiterAnswerOptionView> options) {
}
