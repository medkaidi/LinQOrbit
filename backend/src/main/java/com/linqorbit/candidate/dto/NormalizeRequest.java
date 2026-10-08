package com.linqorbit.candidate.dto;

/**
 * Corps JSON envoyé au service IA pour la normalisation de profil : le
 * snapshot du profil candidat tel quel + le contexte de référence (vérité DB).
 * Les deux sont en camelCase (alias to_camel côté service IA).
 */
public record NormalizeRequest(
        CandidateProfileResponse profile,
        ParseContext context) {
}
