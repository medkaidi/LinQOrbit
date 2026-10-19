package com.linqorbit.candidate.entity;

/**
 * Versions courantes du format canonique ({@code normalized_profile.schema_version}),
 * source unique côté backend (D63). Chaque fiche se compare à <b>sa</b>
 * version attendue : la version candidat et la version offre ne sont jamais
 * comparées entre elles. Le service IA garde ses propres constantes (frontière
 * de langage) ; le backend est la source de vérité et le worker refuse toute
 * réponse divergente.
 */
public final class NormalizedProfileSchemaVersions {

    /** Fiche candidat : format canonique v3 (D36). */
    public static final String CANDIDATE = "3";
    /** Fiche offre : format canonique v2 (D35). */
    public static final String OFFER = "2";

    private NormalizedProfileSchemaVersions() {
    }

    /** Version attendue pour la source d'un job de normalisation. */
    public static String of(NormalizationSourceType sourceType) {
        return sourceType == NormalizationSourceType.OFFER ? OFFER : CANDIDATE;
    }
}
