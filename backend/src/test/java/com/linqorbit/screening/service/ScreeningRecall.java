package com.linqorbit.screening.service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Calcul du rappel du screening (SPEC §8.4.8) : parmi les candidats que l'on
 * <b>aurait dû</b> retrouver pour une offre (la vérité terrain), quelle part
 * le Top N contient-il. Le screening se juge au rappel, pas à la précision :
 * un bon candidat absent du Top N ne peut plus être rattrapé par le matching.
 */
final class ScreeningRecall {

    private ScreeningRecall() {
    }

    /**
     * {@code |Top N ∩ pertinents| / |pertinents|}, sur les {@code n} premiers
     * du classement. {@code NaN} sans pertinent (offre non mesurable, jamais
     * comptée comme un succès ni comme un échec).
     */
    static double recallAt(List<UUID> ranked, Set<UUID> relevant, int n) {
        if (relevant.isEmpty()) {
            return Double.NaN;
        }
        long found = ranked.stream().limit(Math.max(0, n)).filter(relevant::contains).count();
        return (double) found / relevant.size();
    }

    /** Au moins un pertinent dans le Top N. */
    static boolean hitAt(List<UUID> ranked, Set<UUID> relevant, int n) {
        return ranked.stream().limit(Math.max(0, n)).anyMatch(relevant::contains);
    }

    /** Moyenne des valeurs mesurables (les {@code NaN} sont ignorés) ; {@code NaN} si aucune. */
    static double mean(List<Double> values) {
        return values.stream().filter(v -> !Double.isNaN(v)).mapToDouble(Double::doubleValue).average()
                .orElse(Double.NaN);
    }

    /** Plus petite valeur mesurable ; {@code NaN} si aucune. */
    static double min(List<Double> values) {
        return values.stream().filter(v -> !Double.isNaN(v)).mapToDouble(Double::doubleValue).min()
                .orElse(Double.NaN);
    }
}
