package com.linqorbit.matching.service;

import lombok.Getter;

/**
 * Sections du matching (D58), jamais mélangées : chacune a son propre score
 * (moyenne pondérée de ses critères). L'ordre des constantes est l'ordre
 * d'affichage.
 */
@Getter
public enum MatchingSection {

    REQUIRED_SKILLS("required_skills"),
    PREFERRED_SKILLS("preferred_skills"),
    LANGUAGES("languages"),
    EXPERIENCE("experience"),
    EDUCATION("education");

    private final String apiValue;

    MatchingSection(String apiValue) {
        this.apiValue = apiValue;
    }
}
