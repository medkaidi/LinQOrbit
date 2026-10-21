package com.linqorbit.application.dto;

/**
 * Score d'une des cinq sections du matching (D58), {@code null} quand la
 * section n'existe pas dans le résultat — jamais 0 par défaut.
 */
public record RecruiterSectionScore(
        String section,
        Double score) {
}
