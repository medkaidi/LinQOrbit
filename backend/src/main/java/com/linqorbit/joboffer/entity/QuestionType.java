package com.linqorbit.joboffer.entity;

import lombok.Getter;

/**
 * Type de question de présélection (D47), stocké en SMALLINT (colonne
 * job_offer_question.question_type). Cinq types au MVP — les autres types du
 * §10.1 sont documentés comme mappés (expérience → NUMBER, langue →
 * SINGLE_CHOICE) ou reportés (date, localisation, autre). Code et valeur API
 * déclarés ensemble pour qu'aucun des deux mappings ne dépende de l'ordre des
 * constantes.
 */
@Getter
public enum QuestionType {

    TEXT(1, "text"),
    SINGLE_CHOICE(2, "single_choice"),
    MULTIPLE_CHOICE(3, "multiple_choice"),
    YES_NO(4, "yes_no"),
    NUMBER(5, "number");

    private final int code;
    private final String apiValue;

    QuestionType(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    /** Les deux types porteurs d'options (choix unique / multiple). */
    public boolean isChoice() {
        return this == SINGLE_CHOICE || this == MULTIPLE_CHOICE;
    }

    public static QuestionType fromCode(short code) {
        for (QuestionType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        throw new IllegalArgumentException("Code de type de question inconnu : " + code);
    }

    public static QuestionType fromApiValue(String value) {
        for (QuestionType type : values()) {
            if (type.apiValue.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Valeur de type de question inconnue : " + value);
    }
}
