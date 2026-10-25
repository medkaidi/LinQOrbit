package com.linqorbit.invitation.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.linqorbit.invitation.dto.SuggestedSkill;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Extrait d'une fiche candidat normalisée les champs d'une <b>liste blanche</b>
 * affichés sur la carte d'un candidat suggéré (T-101, D85) : poste actuel,
 * séniorité, années d'expérience, pays, compétences hors {@code soft_skill}.
 *
 * <p>Depuis T-102 (D86) le candidat a consenti à la visibilité de son profil
 * complet : cette liste ne protège plus l'identité (le nom vient du compte),
 * elle <b>borne le contenu de la carte</b> à ce qui sert au tri d'un coup
 * d'œil. Le contrôle reste positif : chaque champ est lu par son nom, rien
 * n'est copié « sauf » une liste d'exclusions. Jamais de réutilisation du
 * rendu texte d'embedding ({@code ProfileTextRenderer}) : ce rendu est
 * versionné pour la similarité (le modifier bumpe {@code text-1}).</p>
 *
 * <p>Tolérant aux fiches partielles ou illisibles : un champ absent ou mal
 * typé est {@code null}, jamais une erreur.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CandidateCardAnonymizer {

    /** Nombre maximal de compétences affichées sur une carte. */
    static final int MAX_SKILLS = 8;
    private static final String SOFT_SKILL = "soft_skill";

    private final ObjectMapper objectMapper;

    /** Champs de carte extraits d'une fiche ; tous les champs sont {@code null}/vides si la fiche est illisible. */
    public record Card(String title, String seniority, Integer yearsOfExperience, String country,
            List<SuggestedSkill> skills) {

        static Card empty() {
            return new Card(null, null, null, null, List.of());
        }
    }

    public Card anonymize(String contentJson) {
        if (contentJson == null || contentJson.isBlank()) {
            return Card.empty();
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(contentJson);
        } catch (JacksonException ex) {
            log.warn("Suggested candidate card : unreadable normalized profile");
            return Card.empty();
        }
        if (root == null || !root.isObject()) {
            return Card.empty();
        }
        return new Card(
                text(root, "title"),
                text(root, "seniority"),
                integer(root, "yearsOfExperience"),
                text(root.path("location"), "country"),
                skills(root.path("skills")));
    }

    private List<SuggestedSkill> skills(JsonNode skills) {
        if (!skills.isArray()) {
            return List.of();
        }
        List<JsonNode> kept = new ArrayList<>();
        for (JsonNode skill : skills) {
            if (skill.isObject() && text(skill, "name") != null && !SOFT_SKILL.equals(text(skill, "category"))) {
                kept.add(skill);
            }
        }
        kept.sort(Comparator
                .comparing((JsonNode s) -> Optional.ofNullable(integer(s, "level")).orElse(0)).reversed()
                .thenComparing(s -> Optional.ofNullable(integer(s, "yearsExperience")).orElse(0),
                        Comparator.reverseOrder())
                .thenComparing(s -> text(s, "name"), String.CASE_INSENSITIVE_ORDER));
        return kept.stream()
                .limit(MAX_SKILLS)
                .map(s -> new SuggestedSkill(text(s, "name"), integer(s, "level")))
                .toList();
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (!value.isString()) {
            return null;
        }
        String trimmed = value.asString().trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isIntegralNumber() ? value.asInt() : null;
    }
}
