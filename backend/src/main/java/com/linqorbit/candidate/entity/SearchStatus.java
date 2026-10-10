package com.linqorbit.candidate.entity;

import lombok.Getter;

/**
 * Statut de recherche d'un candidat, stocké en SMALLINT (colonne candidates.search_status).
 * Code et valeur API sont déclarés ensemble pour qu'aucun des deux mappings
 * (base et JSON) ne dépende de l'ordre des constantes.
 */
@Getter
public enum SearchStatus {

    OPEN_TO_WORK(1, "open_to_work"),
    SELECTIVE(2, "selective"),
    NOT_LOOKING(3, "not_looking");

    private final int code;
    private final String apiValue;

    SearchStatus(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static SearchStatus fromCode(short code) {
        for (SearchStatus status : values()) {
            if (status.code == code) {
                return status;
            }
        }
        throw new IllegalArgumentException("Code de statut de recherche inconnu : " + code);
    }

    public static SearchStatus fromApiValue(String value) {
        for (SearchStatus status : values()) {
            if (status.apiValue.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Valeur de statut de recherche inconnue : " + value);
    }
}
