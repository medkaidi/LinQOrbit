package com.linqorbit.joboffer.service;

import java.util.Locale;

import com.linqorbit.joboffer.repository.JobOfferSearch;

/**
 * Motif {@code LIKE} d'une recherche texte d'offres (T-70, T-77) : le texte de
 * l'utilisateur est une <b>valeur littérale</b>, jamais un motif — {@code %},
 * {@code _} et le caractère d'échappement sont neutralisés (sinon {@code %_%_%…}
 * ferait un scan coûteux sur une route publique) et la longueur est bornée.
 * Pré-calculé en Java (piège {@code bytea} de T-48 : un paramètre nul
 * concaténé en SQL n'a pas de type inférable).
 */
public final class OfferSearchPattern {

    private static final char ESCAPE = JobOfferSearch.LIKE_ESCAPE;

    /** Longueur maximale de la recherche, après trim — le surplus est ignoré. */
    static final int MAX_LENGTH = 100;

    private OfferSearchPattern() {
    }

    /** Motif {@code %texte%} en minuscules, {@code null} si le texte est absent ou blanc. */
    public static String of(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }
        String trimmed = query.trim();
        if (trimmed.codePointCount(0, trimmed.length()) > MAX_LENGTH) {
            trimmed = trimmed.substring(0, trimmed.offsetByCodePoints(0, MAX_LENGTH)).trim();
        }
        StringBuilder pattern = new StringBuilder(trimmed.length() + 4).append('%');
        for (char c : trimmed.toLowerCase(Locale.ROOT).toCharArray()) {
            if (c == ESCAPE || c == '%' || c == '_') {
                pattern.append(ESCAPE);
            }
            pattern.append(c);
        }
        return pattern.append('%').toString();
    }
}
