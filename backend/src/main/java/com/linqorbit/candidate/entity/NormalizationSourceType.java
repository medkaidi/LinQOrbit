package com.linqorbit.candidate.entity;

import lombok.Getter;

/**
 * Source d'un job de normalisation, stockée en SMALLINT
 * ({@code normalization_job.source_type}) : le worker unique branche sur
 * cette colonne après le claim (snapshot et agent dédiés par source).
 */
@Getter
public enum NormalizationSourceType {

    CANDIDATE(1),
    OFFER(2);

    private final int code;

    NormalizationSourceType(int code) {
        this.code = code;
    }

    public static NormalizationSourceType fromCode(short code) {
        for (NormalizationSourceType sourceType : values()) {
            if (sourceType.code == code) {
                return sourceType;
            }
        }
        throw new IllegalArgumentException("Code de source de normalisation inconnu : " + code);
    }
}
