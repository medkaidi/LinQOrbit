package com.linqorbit.matching.service;

import java.util.List;

/**
 * Exigence de formation structurée du critère conjoint {@code education:requirement}
 * (D67/D68) : niveaux de diplôme (alternatives « l'un d'eux ou au-dessus »),
 * credentials (« Professional certificate », jamais un niveau) et domaines
 * d'étude (alternatives). Le service IA note la formation en code à partir de
 * ces listes — il ne parse jamais le texte de l'attente.
 */
public record MatchingEducation(
        List<String> degreeLevels,
        List<String> credentials,
        List<String> fields) {
}
