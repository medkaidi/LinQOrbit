package com.linqorbit.candidate.dto;

import java.util.List;

/**
 * Vue agrégée du profil candidat : toutes les sections + taux de complétion.
 * Un seul GET suffit à rendre la page ; chaque section se sauvegarde séparément.
 */
public record CandidateProfileResponse(
        AboutResponse about,
        List<ExperienceResponse> experiences,
        List<DiplomaResponse> diplomas,
        List<SkillResponse> skills,
        List<LanguageResponse> languages,
        List<LinkResponse> links,
        int completionPercentage) {
}
