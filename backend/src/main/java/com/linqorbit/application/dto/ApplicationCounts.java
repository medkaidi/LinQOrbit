package com.linqorbit.application.dto;

/**
 * Nombre de candidatures du candidat par statut (un compteur par valeur de
 * {@code ApplicationStatus}, 0 quand il n'y en a aucune).
 */
public record ApplicationCounts(
        long draft,
        long submitted,
        long withdrawn,
        long accepted,
        long rejected) {
}
