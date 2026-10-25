package com.linqorbit.invitation.dto;

import com.linqorbit.candidate.dto.CandidateProfileResponse;

/**
 * Profil complet d'un candidat suggéré, vu par le recruteur (T-102, D86) : la
 * carte (identité, rang, statut), la localisation courante du compte et le
 * profil professionnel — même source que la vue du candidat et la console
 * admin. <b>Jamais d'e-mail ni de téléphone</b> : aucun de ces champs n'existe
 * dans cette réponse (le texte de consentement les exclut) ; le contact passe
 * par l'invitation dans la plateforme.
 *
 * @param canInvite droit de gestion D12 de l'offre, calculé par le serveur
 */
public record SuggestedCandidateProfileResponse(
        SuggestedCandidateCard card,
        String currentCity,
        String currentCountry,
        boolean canInvite,
        CandidateProfileResponse profile) {
}
