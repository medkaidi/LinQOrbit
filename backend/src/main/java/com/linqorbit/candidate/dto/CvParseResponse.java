package com.linqorbit.candidate.dto;

import java.util.List;

/**
 * Extraction structurée d'un CV par le service IA (contrat JSON du endpoint
 * d'import). Rien n'est persisté : le client prévisualise puis applique.
 * Les dates sont au format texte "YYYY-MM" telles que produites par l'IA.
 */
public record CvParseResponse(
        String title,
        String summary,
        List<Experience> experiences,
        List<Diploma> diplomas,
        List<Skill> skills,
        List<Language> languages,
        List<Link> links) {

    public record Experience(
            String positionTitle,
            String companyName,
            String companyCountry,
            String startDate,
            String endDate,
            String description) {
    }

    public record Diploma(
            String title,
            String institution,
            String institutionCountry,
            String degreeLabel,
            String studyFieldLabel,
            String startDate,
            String endDate) {
    }

    public record Skill(String name, Integer level, Integer yearsExperience) {
    }

    public record Language(String name, String level) {
    }

    public record Link(String label, String url) {
    }
}
