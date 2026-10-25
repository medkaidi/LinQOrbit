package com.linqorbit.invitation.dto;

/**
 * Compétence affichée sur une carte de candidat suggéré : nom et niveau déclaré
 * (1–5, {@code null} si inconnu). Rien d'autre du skill du candidat.
 */
public record SuggestedSkill(String name, Integer level) {
}
