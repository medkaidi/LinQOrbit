package com.linqorbit.application.service;

import lombok.Getter;

/**
 * Étape du parcours de candidature (D59), <b>calculée</b> à chaque lecture du
 * contexte et jamais stockée : elle se déduit des données (brouillon,
 * obligatoires répondues, transmission). Une revalidation du profil recrée le
 * matching (D50) sans toucher aux réponses du recruteur — l'étape suit
 * d'elle-même. Les étapes clarifications et arbitrage arrivent avec T-62/T-63.
 */
@Getter
public enum ApplicationStep {

    /** Pas de brouillon, ou au moins une question obligatoire sans réponse. */
    RECRUITER_QUESTIONS("recruiter_questions"),
    /** Brouillon complet : matching facultatif ouvert, transmission possible. */
    MATCHING("matching"),
    /** Candidature transmise (quel que soit son statut ensuite). */
    SUBMITTED("submitted");

    private final String apiValue;

    ApplicationStep(String apiValue) {
        this.apiValue = apiValue;
    }
}
