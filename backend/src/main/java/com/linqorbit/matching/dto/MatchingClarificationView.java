package com.linqorbit.matching.dto;

import java.util.UUID;

/**
 * Question IA ouverte, telle que montrée au candidat (T-62) : la question,
 * pourquoi elle est posée (texte candidat, jamais la justification d'un
 * score), son rang parmi les questions déjà posées (1-based, passages inclus)
 * et le nombre de questions qui pourront encore suivre celle-ci.
 */
public record MatchingClarificationView(
        UUID id,
        String question,
        String rationale,
        int questionNumber,
        int remainingQuestions) {
}
