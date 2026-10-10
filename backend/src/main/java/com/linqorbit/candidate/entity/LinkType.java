package com.linqorbit.candidate.entity;

import lombok.Getter;

/**
 * Type de lien du profil candidat, stocké en SMALLINT (colonne candidate_links.link_type).
 * Liste prédéfinie : ajouter un type = une constante ici, aucune migration
 * (la colonne ne porte pas de CHECK, à l'image de users.status).
 */
@Getter
public enum LinkType {

    LINKEDIN(1, "linkedin"),
    GITHUB(2, "github"),
    GITLAB(3, "gitlab"),
    STACK_OVERFLOW(4, "stack_overflow"),
    WEBSITE(5, "website"),
    X(6, "x"),
    YOUTUBE(7, "youtube"),
    DRIBBBLE(8, "dribbble"),
    BEHANCE(9, "behance"),
    CERTIFICATION(10, "certification"),
    OTHER(11, "other");

    private final int code;
    private final String apiValue;

    LinkType(int code, String apiValue) {
        this.code = code;
        this.apiValue = apiValue;
    }

    public static LinkType fromCode(short code) {
        for (LinkType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        throw new IllegalArgumentException("Code de type de lien inconnu : " + code);
    }

    public static LinkType fromApiValue(String value) {
        for (LinkType type : values()) {
            if (type.apiValue.equals(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Valeur de type de lien inconnue : " + value);
    }
}
