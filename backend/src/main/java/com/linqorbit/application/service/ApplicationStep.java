package com.linqorbit.application.service;

import lombok.Getter;

/**
 * Étape du parcours de candidature (D59), <b>calculée</b> à chaque lecture du
 * contexte et jamais stockée : elle se déduit des données (brouillon,
 * obligatoires répondues, transmission). Une revalidation du profil recrée le
 * matching (D50) sans toucher aux réponses du recruteur — l'étape suit
 * d'elle-même. Le serveur n'expose que ces trois étapes ; l'avancement des
 * clarifications et de la contestation (T-62/T-63) passe par l'objet
 * {@code assessment} du contexte ({@code matched}, {@code assessmentOpen},
 * {@code assessmentFinished}, {@code contested}), dont le frontend dérive ses quatre étapes visuelles
 * (Recruiter questions, Dynamic Candidate Assessment, Candidate review, Summary &amp; apply).
 * Une offre sans aucune question ouvre directement l'étape {@code MATCHING}.
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
