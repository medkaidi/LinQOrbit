package com.linqorbit.application.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.linqorbit.application.dto.RecruiterAssessmentSectionView;
import com.linqorbit.application.dto.RecruiterAssessmentView;
import com.linqorbit.application.dto.RecruiterContestationView;
import com.linqorbit.application.dto.RecruiterContestedSection;
import com.linqorbit.application.dto.RecruiterCriterionView;
import com.linqorbit.matching.entity.MatchingCriterionFeedback;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.repository.MatchingResultRepository;
import com.linqorbit.matching.service.MatchingResultReader;
import com.linqorbit.matching.service.MatchingResultReader.CriterionScore;
import com.linqorbit.matching.service.MatchingSection;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.JsonNode;

/**
 * Lecture d'une évaluation IA épinglée (T-66, T-86) : sections, contestations
 * et écart moyen, assemblés depuis le JSON du résultat.
 *
 * <p>Partagé par la vue recruteur d'une candidature et par le dossier admin
 * d'un signalement (D66) : les deux vues lisent donc exactement les mêmes
 * scores, les mêmes justifications et le même écart moyen — aucune formule
 * recopiée. Le résultat est immuable : rien n'est recalculé ni rejoué.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApplicationAssessmentReader {

    private static final List<MatchingSection> SECTIONS = List.of(MatchingSection.values());

    private final MatchingResultReader matchingResultReader;
    private final MatchingResultRepository matchingResultRepository;

    /** Arbre JSON d'un résultat ; {@code null} sans résultat ou sans contenu. */
    public JsonNode tree(MatchingResult result) {
        return matchingResultReader.tree(result);
    }

    /** Critère résolu (section, libellé, score) ; {@code null} si la clé est absente. */
    public CriterionScore criterion(JsonNode root, String key) {
        return matchingResultReader.criterion(root, key);
    }

    /**
     * Critère complet d'un résultat (libellé, exigence, poids, score,
     * justification) et son score de section — lecture du dossier admin.
     * {@code null} si la clé n'existe pas dans ce résultat.
     */
    public CriterionDetail criterionDetail(JsonNode root, String key) {
        if (root == null || key == null) {
            return null;
        }
        for (JsonNode section : root.path("sections")) {
            for (JsonNode item : section.path("criteria")) {
                if (!key.equals(item.path("key").asString())) {
                    continue;
                }
                JsonNode requirement = item.get("requirement");
                MatchingSection resolved = MatchingSection.fromStorageValue(section.path("section").asString());
                RecruiterCriterionView criterion = new RecruiterCriterionView(
                        item.path("key").asString(key),
                        item.path("label").asString(key),
                        requirement == null || requirement.isNull() ? null : requirement.asString(),
                        item.path("weight").asInt(0),
                        item.path("score").asInt(0),
                        item.path("rationale").asString(""));
                return new CriterionDetail(resolved == null ? null : resolved.getSectionKey(),
                        scoreOf(section), criterion);
            }
        }
        return null;
    }

    /** Évaluation complète : une entrée par section, critères et scores agrégés. */
    public RecruiterAssessmentView assessment(JsonNode root) {
        if (root == null) {
            return new RecruiterAssessmentView(false, List.of());
        }
        List<RecruiterAssessmentSectionView> sections = new ArrayList<>(SECTIONS.size());
        for (MatchingSection section : SECTIONS) {
            JsonNode node = sectionNode(root, section.getStorageValue());
            sections.add(new RecruiterAssessmentSectionView(section.getSectionKey(),
                    node == null ? null : scoreOf(node), criteria(node)));
        }
        return new RecruiterAssessmentView(true, sections);
    }

    /** Résultats d'origine des contestations, chargés en une requête. */
    public Map<UUID, MatchingResult> feedbackResults(List<MatchingCriterionFeedback> feedback) {
        List<UUID> ids = feedback.stream().map(MatchingCriterionFeedback::getMatchingResultId)
                .distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, MatchingResult> results = new HashMap<>();
        matchingResultRepository.findAllById(ids).forEach(result -> results.put(result.getId(), result));
        return results;
    }

    /**
     * Contestations lisibles : la note IA vient du résultat d'origine de la
     * contestation. Les lectures latest-only ne fournissent que le résultat
     * affiché ; un critère introuvable est écarté (jamais de note inventée,
     * jamais de note empruntée à un autre résultat).
     */
    public List<RecruiterContestationView> contests(List<MatchingCriterionFeedback> feedback,
            Map<UUID, MatchingResult> feedbackResults) {
        List<RecruiterContestationView> contests = new ArrayList<>(feedback.size());
        for (MatchingCriterionFeedback item : feedback) {
            JsonNode root = tree(feedbackResults.get(item.getMatchingResultId()));
            CriterionScore criterion = criterion(root, item.getCriterionKey());
            if (criterion == null) {
                log.warn("Contestation skipped : criterion missing, feedbackId={}, key={}",
                        item.getId(), item.getCriterionKey());
                continue;
            }
            int gap = Math.abs(item.getSelfValue() - criterion.score());
            contests.add(new RecruiterContestationView(item.getCriterionKey(), criterion.label(),
                    criterion.score(), item.getSelfValue(), gap, item.getComment()));
        }
        return contests;
    }

    /**
     * Écart moyen absolu (une décimale), nombre de critères comparables et
     * répartition par section. Une seule boucle : la somme par section est
     * donc toujours égale au nombre de critères comparables.
     */
    public GapStats gapStats(List<MatchingCriterionFeedback> feedback,
            Map<UUID, MatchingResult> feedbackResults) {
        if (feedback.isEmpty()) {
            return GapStats.NONE;
        }
        BigDecimal total = BigDecimal.ZERO;
        int counted = 0;
        Map<MatchingSection, Integer> perSection = new EnumMap<>(MatchingSection.class);
        for (MatchingCriterionFeedback item : feedback) {
            JsonNode root = tree(feedbackResults.get(item.getMatchingResultId()));
            CriterionScore criterion = criterion(root, item.getCriterionKey());
            if (criterion != null) {
                total = total.add(BigDecimal.valueOf(Math.abs(item.getSelfValue() - criterion.score())));
                counted++;
                if (criterion.section() != null) {
                    perSection.merge(criterion.section(), 1, Integer::sum);
                }
            }
        }
        Double average = counted == 0 ? null
                : total.divide(BigDecimal.valueOf(counted), 1, RoundingMode.HALF_UP).doubleValue();
        List<RecruiterContestedSection> sections = perSection.entrySet().stream()
                .map(entry -> new RecruiterContestedSection(entry.getKey().getSectionKey(), entry.getValue()))
                .toList();
        return new GapStats(counted, average, sections);
    }

    private static JsonNode sectionNode(JsonNode root, String storageValue) {
        if (root == null) {
            return null;
        }
        for (JsonNode section : root.path("sections")) {
            if (storageValue.equals(section.path("section").asString())) {
                return section;
            }
        }
        return null;
    }

    private static Double scoreOf(JsonNode section) {
        JsonNode score = section.get("score");
        return score == null || score.isNull() ? null : score.asDouble();
    }

    private static List<RecruiterCriterionView> criteria(JsonNode section) {
        if (section == null) {
            return List.of();
        }
        List<RecruiterCriterionView> criteria = new ArrayList<>();
        for (JsonNode item : section.path("criteria")) {
            JsonNode requirement = item.get("requirement");
            criteria.add(new RecruiterCriterionView(item.path("key").asString(""),
                    item.path("label").asString(""),
                    requirement == null || requirement.isNull() ? null : requirement.asString(),
                    item.path("weight").asInt(0), item.path("score").asInt(0),
                    item.path("rationale").asString("")));
        }
        return criteria;
    }

    /** Critère complet + score de section, pour le dossier admin d'un signalement. */
    public record CriterionDetail(String section, Double sectionScore, RecruiterCriterionView criterion) {
    }

    /** {@code sections} : sections contestées dans l'ordre d'affichage, {@code count >= 1} chacune. */
    public record GapStats(int count, Double averageGap, List<RecruiterContestedSection> sections) {
        public static final GapStats NONE = new GapStats(0, null, List.of());
    }
}
