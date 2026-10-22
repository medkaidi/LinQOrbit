package com.linqorbit.matching.service;

import lombok.Getter;

/**
 * Sections du matching (D58), jamais mélangées : chacune a son propre score
 * (moyenne pondérée de ses critères). L'ordre des constantes est l'ordre
 * d'affichage.
 *
 * <p>Deux valeurs par section : la valeur de <b>stockage</b> (JSON du
 * résultat IA et API candidat) et la <b>clé de section</b> des API recruteur
 * et administration (camelCase) — une seule source pour le vocabulaire, plus
 * aucune table de correspondance dupliquée dans les vues.</p>
 */
@Getter
public enum MatchingSection {

    REQUIRED_SKILLS("required_skills", "requiredSkills"),
    PREFERRED_SKILLS("preferred_skills", "preferredSkills"),
    LANGUAGES("languages", "languages"),
    EXPERIENCE("experience", "experience"),
    EDUCATION("education", "education");

    /** Valeur de stockage : JSON du résultat IA et API candidat. */
    private final String storageValue;

    /** Clé de section des API recruteur et administration. */
    private final String sectionKey;

    MatchingSection(String storageValue, String sectionKey) {
        this.storageValue = storageValue;
        this.sectionKey = sectionKey;
    }

    /** Section d'après sa valeur de stockage ; {@code null} si inconnue. */
    public static MatchingSection fromStorageValue(String value) {
        for (MatchingSection section : values()) {
            if (section.storageValue.equals(value)) {
                return section;
            }
        }
        return null;
    }
}
