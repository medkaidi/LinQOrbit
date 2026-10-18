package com.linqorbit.matching.service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;

/**
 * Extraction des critères depuis la fiche offre v2 (D58) — la fiche offre est
 * la grille de référence. Cinq sections : compétences obligatoires
 * ({@code requiredSkills}), souhaitables ({@code preferredSkills}), langues,
 * expérience ({@code requiredYears}), formation (diplômes, domaines d'étude,
 * certifications). Une exigence inférée compte comme une déclarée (révise
 * D35) : la provenance n'entre jamais dans la grille.
 *
 * <p>Poids : le {@code weight} 1-5 de la fiche pour les compétences (toujours
 * présent au schéma v2 — repli 1 si une vieille fiche en manque), 1 pour tous
 * les autres critères. Clés stables {@code <type>:<slug>} (slug ASCII
 * minuscule, collision → suffixe {@code -2}, {@code -3}…) : elles sont le
 * contrat des résultats stockés et de la contestation (D54).</p>
 */
@Component
public class MatchingCriteriaBuilder {

    static final int DEFAULT_WEIGHT = 1;

    public List<MatchingCriterion> build(JsonNode offer) {
        List<MatchingCriterion> criteria = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();
        addSkills(criteria, usedKeys, offer.path("requiredSkills"), MatchingSection.REQUIRED_SKILLS);
        addSkills(criteria, usedKeys, offer.path("preferredSkills"), MatchingSection.PREFERRED_SKILLS);
        for (JsonNode language : items(offer.path("languages"))) {
            String name = text(language, "name");
            if (name == null) {
                continue;
            }
            String level = text(language, "level");
            boolean required = !language.path("required").isBoolean() || language.path("required").asBoolean();
            String requirement = (level == null ? "Any level" : "CEFR " + level)
                    + (required ? ", required" : ", nice to have");
            criteria.add(new MatchingCriterion(uniqueKey(usedKeys, "language", name), MatchingSection.LANGUAGES,
                    name, requirement, DEFAULT_WEIGHT));
        }
        JsonNode requiredYears = offer.path("requiredYears");
        if (requiredYears.isNumber()) {
            criteria.add(new MatchingCriterion(uniqueKey(usedKeys, "experience", "total"), MatchingSection.EXPERIENCE,
                    "Relevant experience",
                    "At least " + requiredYears.asInt() + " years of experience relevant to this role",
                    DEFAULT_WEIGHT));
        }
        addLabels(criteria, usedKeys, offer.path("requiredDegrees"), "label", "degree", "Degree: ");
        addLabels(criteria, usedKeys, offer.path("requiredStudyFields"), "label", "study-field", "Field of study: ");
        addLabels(criteria, usedKeys, offer.path("certifications"), "name", "certification", "Certification: ");
        return criteria;
    }

    private void addSkills(List<MatchingCriterion> criteria, Set<String> usedKeys, JsonNode skills,
            MatchingSection section) {
        for (JsonNode skill : items(skills)) {
            String name = text(skill, "name");
            if (name == null) {
                continue;
            }
            List<String> parts = new ArrayList<>();
            if (skill.path("level").isNumber()) {
                parts.add("level " + skill.path("level").asInt() + "/5");
            }
            if (skill.path("minYears").isNumber()) {
                parts.add("at least " + skill.path("minYears").asInt() + " years");
            }
            criteria.add(new MatchingCriterion(uniqueKey(usedKeys, "skill", name), section, name,
                    parts.isEmpty() ? null : String.join(", ", parts), weightOf(skill)));
        }
    }

    private void addLabels(List<MatchingCriterion> criteria, Set<String> usedKeys, JsonNode entries, String field,
            String type, String prefix) {
        for (JsonNode entry : items(entries)) {
            String label = text(entry, field);
            if (label == null) {
                continue;
            }
            criteria.add(new MatchingCriterion(uniqueKey(usedKeys, type, label), MatchingSection.EDUCATION,
                    prefix + label, null, DEFAULT_WEIGHT));
        }
    }

    private static int weightOf(JsonNode skill) {
        JsonNode weight = skill.path("weight");
        if (weight.isNumber() && weight.asInt() >= 1 && weight.asInt() <= 5) {
            return weight.asInt();
        }
        return DEFAULT_WEIGHT;
    }

    private static List<JsonNode> items(JsonNode array) {
        List<JsonNode> items = new ArrayList<>();
        if (array != null && array.isArray()) {
            array.forEach(items::add);
        }
        return items;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isString()) {
            return null;
        }
        String text = value.asString().strip();
        return text.isEmpty() ? null : text;
    }

    /** Clé {@code type:slug} unique dans la liste (collision → suffixe numérique). */
    static String uniqueKey(Set<String> usedKeys, String type, String value) {
        String base = type + ":" + slug(value);
        String key = base;
        int suffix = 2;
        while (!usedKeys.add(key)) {
            key = base + "-" + suffix++;
        }
        return key;
    }

    static String slug(String value) {
        // « C++ », « C# » et « C » ne doivent pas se confondre : les symboles
        // porteurs de sens sont épelés avant de normaliser.
        String spelled = value.replace("+", " plus ").replace("#", " sharp ");
        String ascii = Normalizer.normalize(spelled, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+)|(-+$)", "");
        return slug.isEmpty() ? "item" : slug;
    }
}
