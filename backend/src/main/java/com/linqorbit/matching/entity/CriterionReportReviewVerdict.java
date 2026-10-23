package com.linqorbit.matching.entity;

import lombok.Getter;

/**
 * Verdict d'une revue interne de signalement d'évaluation IA (T-96, D77/D78),
 * stocké en SMALLINT : 1 = UPHELD (le signalement est valide, le score IA doit
 * être corrigé), 2 = NOT_UPHELD (le score IA est maintenu). Code et valeur API
 * déclarés ensemble ; jamais {@code @Enumerated(ORDINAL)}.
 */
@Getter
public enum CriterionReportReviewVerdict {
    UPHELD(1, "upheld"),
    NOT_UPHELD(2, "notUpheld");

    private final int code;
    private final String apiValue;

    CriterionReportReviewVerdict(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static CriterionReportReviewVerdict fromCode(short code) {
        for (CriterionReportReviewVerdict verdict : values()) {
            if (verdict.code == code) {
                return verdict;
            }
        }
        throw new IllegalArgumentException("Code de verdict de revue inconnu : " + code);
    }

    /** Seul un signalement confirmé peut porter une correction. */
    public boolean allowsCorrection() {
        return this == UPHELD;
    }
}
