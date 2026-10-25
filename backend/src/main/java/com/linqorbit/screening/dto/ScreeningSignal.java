package com.linqorbit.screening.dto;

/**
 * Signal d'affichage du screening d'une offre (T-101, D85) : statut du
 * dernier job ({@code pending}, {@code running}, {@code done}, {@code failed})
 * et nombre de candidats suggérés ({@code null} tant que le job n'est pas
 * {@code done}). Même forme dans le détail et la liste des offres et dans
 * l'événement SSE — le GET reste la source de vérité. Absent (null) dans les
 * réponses d'offre tant qu'aucun screening n'a été demandé ; l'événement SSE
 * utilise alors le statut {@code none}.
 */
public record ScreeningSignal(String status, Integer candidateCount) {

    /** Statut diffusé par SSE quand l'offre n'a pas (ou plus) de screening. */
    public static final String NONE = "none";

    public static ScreeningSignal none() {
        return new ScreeningSignal(NONE, null);
    }
}
