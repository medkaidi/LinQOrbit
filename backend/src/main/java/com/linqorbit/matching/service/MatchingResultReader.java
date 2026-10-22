package com.linqorbit.matching.service;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.matching.entity.MatchingResult;

/**
 * Lecture du résultat d'un matching (D51) : le JSON est la source unique de
 * l'évaluation affichée. Ce lecteur est partagé par les vues qui consomment
 * un résultat épinglé — la vue recruteur des candidatures (T-66) et la
 * console d'administration (T-86) — pour que la résolution d'un critère
 * (clé → libellé, section, score, score de section) soit identique partout.
 *
 * <p>Le résultat est immuable : la résolution ne recalcule jamais une note,
 * elle relit le JSON figé.</p>
 */
@Component
public class MatchingResultReader {

    private final ObjectMapper objectMapper;

    public MatchingResultReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Arbre JSON d'un résultat ; {@code null} sans résultat ou sans contenu. */
    public JsonNode tree(MatchingResult result) {
        return result == null || result.getResult() == null ? null : objectMapper.readTree(result.getResult());
    }

    /**
     * Critère d'un résultat, par sa clé stable. {@code null} si la clé
     * n'existe pas dans ce résultat (clé inconnue, ou résultat sans contenu).
     * Le score de section est lu dans le même nœud, sans requête
     * supplémentaire ; {@code null} s'il n'est pas présent.
     */
    public CriterionScore criterion(JsonNode root, String key) {
        if (root == null || key == null) {
            return null;
        }
        for (JsonNode section : root.path("sections")) {
            for (JsonNode item : section.path("criteria")) {
                if (key.equals(item.path("key").asString())) {
                    JsonNode sectionScore = section.get("score");
                    return new CriterionScore(MatchingSection.fromStorageValue(section.path("section").asString()),
                            item.path("label").asString(key), item.path("score").asInt(0),
                            sectionScore == null || sectionScore.isNull() ? null : sectionScore.asDouble());
                }
            }
        }
        return null;
    }

    /** Critère résolu : section, libellé, score de l'IA et score de sa section. */
    public record CriterionScore(MatchingSection section, String label, int score, Double sectionScore) {
    }
}
