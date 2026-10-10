package com.linqorbit.candidate.dto;

/**
 * Corps JSON envoyé au service IA pour la normalisation de profil : le
 * snapshot du profil candidat tel quel + la localisation (users) + le contexte
 * de référence (vérité DB). Les trois sont en camelCase (alias to_camel côté
 * service IA). La location n'est pas exposée par le profil public.
 */
public record NormalizeRequest(
        CandidateProfileResponse profile,
        ProfileLocation location,
        ParseContext context) {
}
