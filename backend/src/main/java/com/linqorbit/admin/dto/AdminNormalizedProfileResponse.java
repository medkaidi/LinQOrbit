package com.linqorbit.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;

import tools.jackson.databind.JsonNode;

/**
 * Enveloppe de consultation d'une fiche normalisée (candidat v2 ou offre v1)
 * côté administration : pass-through du contenu canonique (JsonNode, jamais
 * restructuré ici — le schéma appartient au service IA) + métadonnées de
 * version et de job. {@code content} NULL = job en cours, échec ou jamais
 * rempli ; le statut du job dit lequel.
 */
public record AdminNormalizedProfileResponse(
        UUID profileId,
        int version,
        String schemaVersion,
        LocalDateTime validatedAt,
        String jobStatus,
        JsonNode content) {
}
