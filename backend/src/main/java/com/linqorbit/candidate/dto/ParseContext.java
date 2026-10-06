package com.linqorbit.candidate.dto;

import java.util.List;
import java.util.Map;

/**
 * Référentiel de la base envoyé au service IA avec le PDF (part JSON) : le
 * modèle canonise langues/diplomas/domaines/skills contre cette vérité,
 * le wording du candidat reste intact pour les champs affichés.
 *
 * @param languages   noms EN ('French', 'Arabic'…)
 * @param degrees     libellés EN ('Bachelor's degree'…)
 * @param studyFields libellés EN ('Computer Science'…)
 * @param skills      family -> noms, groupé côté Java (pas côté service IA)
 */
public record ParseContext(
        List<String> languages,
        List<String> degrees,
        List<String> studyFields,
        Map<String, List<String>> skills) {

    public static ParseContext empty() {
        return new ParseContext(List.of(), List.of(), List.of(), Map.of());
    }
}
