package com.linqorbit.application.dto;

import com.linqorbit.candidate.dto.CandidateProfileResponse;

/**
 * Profil complet du candidat d'une **candidature**, vu par un recruteur
 * (T-125, D107).
 *
 * <p>Le candidat a postulé à cette offre : il a donc transmis son CV — qui
 * porte déjà ses coordonnées — et ses réponses à cette entreprise. Le
 * recruteur dispose donc de l'e-mail et du téléphone : sans eux, il n'a aucun
 * moyen de le joindre (le contact passe par la plateforme pour un candidat
 * <i>suggéré</i>, pas pour un candidat qui a candidaté).</p>
 *
 * <p>Ces coordonnées n'existent que sur cette surface : la fiche d'un candidat
 * <b>suggéré</b> reste sans e-mail ni téléphone (T-102, D86).</p>
 *
 * @param candidate identité minimale (prénom, nom, intitulé du poste actuel)
 * @param email e-mail du compte candidat (clé du compte)
 * @param phone numéro saisi par le candidat, absent s'il ne l'a pas renseigné
 * @param currentCity ville déclarée par le candidat
 * @param currentCountry pays (ISO alpha-2) déclaré par le candidat
 * @param profile profil professionnel complet — même source que la vue du
 *                candidat et la console admin
 */
public record RecruiterCandidateProfile(
        RecruiterCandidateSummary candidate,
        String email,
        String phone,
        String currentCity,
        String currentCountry,
        CandidateProfileResponse profile) {
}
