package com.linqorbit.candidate.dto;

import java.util.List;

/**
 * Vue agrégée du profil candidat : toutes les sections + taux de complétion.
 * Un seul GET suffit à rendre la page ; chaque section se sauvegarde séparément.
 *
 * @param hasUnvalidatedChanges signal d'alerte : le profil a changé depuis la
 *        dernière validation (ou n'a jamais été validé) → inviter l'utilisateur
 *        à valider pour relancer l'analyse normalisée
 * @param normalizationFailed la dernière tentative d'analyse a échoué
 *        définitivement → informer l'utilisateur avec un message générique
 *        (le détail de l'erreur reste dans les logs côté backend et service IA)
 * @param normalizationInProgress le job de la dernière validation est en cours
 *        (PENDING ou RUNNING) → afficher « Analyzing… » ; signal persisté en
 *        base, il survit à la navigation
 */
public record CandidateProfileResponse(
        AboutResponse about,
        List<ExperienceResponse> experiences,
        List<DiplomaResponse> diplomas,
        List<SkillResponse> skills,
        List<LanguageResponse> languages,
        List<LinkResponse> links,
        int completionPercentage,
        boolean hasUnvalidatedChanges,
        boolean normalizationFailed,
        boolean normalizationInProgress) {
}
