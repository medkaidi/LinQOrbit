package com.linqorbit.matching.entity;

import lombok.Getter;

/**
 * Motif d'un signalement interne d'une évaluation IA (T-86, D66), stocké en
 * SMALLINT : 1 score incorrect, 2 preuve erronée, 3 profil mal compris,
 * 4 exigence mal comprise, 5 autre. Le motif 5 (« autre ») est le seul qui
 * exige un commentaire : seul lui ne dit rien par lui-même.
 * Code et valeur API déclarés ensemble.
 */
@Getter
public enum CriterionReportReason {
    SCORE_INCORRECT(1, "scoreIncorrect"),
    EVIDENCE_WRONG(2, "evidenceWrong"),
    PROFILE_MISUNDERSTOOD(3, "profileMisunderstood"),
    REQUIREMENT_MISUNDERSTOOD(4, "requirementMisunderstood"),
    OTHER(5, "other");

    private final int code;
    private final String apiValue;

    CriterionReportReason(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static CriterionReportReason fromCode(short code) {
        for (CriterionReportReason reason : values()) {
            if (reason.code == code) {
                return reason;
            }
        }
        throw new IllegalArgumentException("Code de motif de signalement inconnu : " + code);
    }

    /** Le motif « autre » porte l'information dans le commentaire : il l'exige. */
    public boolean requiresComment() {
        return this == OTHER;
    }
}
