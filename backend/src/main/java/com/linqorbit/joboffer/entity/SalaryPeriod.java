package com.linqorbit.joboffer.entity;

import lombok.Getter;

/**
 * Période de la fourchette salariale d'une offre (D14), stockée en SMALLINT
 * (job_offer.salary_period). Pas de salary_type (brut/net) : supprimé en D14.
 */
@Getter
public enum SalaryPeriod {

    YEAR(1, "year"),
    MONTH(2, "month"),
    DAY(3, "day"),
    HOUR(4, "hour");

    private final int code;
    private final String apiValue;

    SalaryPeriod(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static SalaryPeriod fromCode(short code) {
        for (SalaryPeriod period : values()) {
            if (period.code == code) {
                return period;
            }
        }
        throw new IllegalArgumentException("Code de période salariale inconnu : " + code);
    }

    public static SalaryPeriod fromApiValue(String value) {
        for (SalaryPeriod period : values()) {
            if (period.apiValue.equals(value)) {
                return period;
            }
        }
        throw new IllegalArgumentException("Valeur de période salariale inconnue : " + value);
    }
}
