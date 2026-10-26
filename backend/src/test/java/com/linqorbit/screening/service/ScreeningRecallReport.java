package com.linqorbit.screening.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.embedding.service.EmbeddingSettings;
import com.linqorbit.screening.dto.ScreenedCandidate;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Mesure du rappel du screening sur les seeds (SPEC §8.4.8) — <b>outil hors
 * CI</b>, comme les jeux d'essai du barème IA : ignoré sans la propriété
 * {@code screening.recall.truth}. Il interroge le vrai {@link ScreeningService}
 * (donc la vraie requête SQL) sur la base de dev et écrit un rapport daté.
 *
 * <pre>
 * # 1. seeds chargés, puis alignés sur les schémas courants (additif)
 * PYTHONIOENCODING=utf-8 python scripts/seed/generate.py --upgrade | psql …
 * # 2. embeddings générés (ai-service lancé, backend avec EMBEDDING_BACKFILL_ON_BOOT=true)
 * # 3. vérité terrain + mesure
 * python scripts/seed/generate.py --truth &gt; truth.json
 * ./mvnw test -Dtest=ScreeningRecallReport -Dscreening.recall.truth=../truth.json
 * </pre>
 *
 * <p><b>Protocole (vérité terrain = archétype de poste, population éligible)</b> :
 * pour une offre, la vérité terrain est l'ensemble des candidats du <b>même
 * archétype</b> (15 archétypes déterministes), joignables (hors {@code not_looking})
 * et vectorisés. Les candidats <b>pertinents</b> sont ceux de cette vérité qui sont
 * aussi <b>éligibles</b> pour l'offre selon la requête de production
 * ({@link ScreeningEligiblePopulation} : consentement à la visibilité recruteur,
 * pas de candidature à l'offre, pas déjà suggéré) — un candidat que la requête
 * exclut par règle ne peut pas être « manqué » par le Top N. Les exclus par règle
 * sont publiés ({@code excludedByRules}) ; une offre sans aucun pertinent éligible
 * est <b>non mesurable</b> (jamais un rappel de 0). Le rappel@N est la part des
 * pertinents contenue dans le Top N. C'est un <b>proxy de proxy</b> : il mesure la
 * cohérence sémantique de la recherche, pas le top K du matching détaillé. Les
 * offres « non alignées » (leur panier de compétences mélange deux archétypes) sont
 * rapportées à part : leur vérité terrain est ambiguë. Le rapport est en
 * <b>lecture seule</b> sur la base.</p>
 */
@SpringBootTest(properties = "app.embedding.min-interval-ms=0")
@EnabledIfSystemProperty(named = "screening.recall.truth", matches = ".+")
class ScreeningRecallReport {

    private static final List<Integer> NS = List.of(5, 10, 20, 30, 50);
    private static final int MAX_N = 50;

    @Autowired
    private ScreeningService screeningService;
    @Autowired
    private EmbeddingSettings settings;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private ObjectMapper objectMapper;

    // Inertes : la mesure ne doit déclencher aucune génération d'embedding.
    @MockitoBean(name = "embeddingExecutor")
    private ThreadPoolTaskExecutor embeddingExecutor;
    @MockitoBean(name = "embeddingTaskScheduler")
    private TaskScheduler embeddingTaskScheduler;

    @Test
    void measureTheRecallOnTheSeeds() throws Exception {
        JsonNode truth = objectMapper.readTree(new File(System.getProperty("screening.recall.truth")));
        Set<UUID> vectorized = vectorizedCandidates();

        Map<String, Set<UUID>> relevantByArchetype = new HashMap<>();
        for (JsonNode candidate : truth.get("candidates")) {
            UUID id = UUID.fromString(candidate.get("candidateId").asString());
            boolean reachable = !"not_looking".equals(candidate.get("searchStatus").asString());
            if (reachable && vectorized.contains(id)) {
                relevantByArchetype.computeIfAbsent(candidate.get("archetype").asString(), k -> new HashSet<>())
                        .add(id);
            }
        }

        List<Map<String, Object>> offers = new ArrayList<>();
        Map<Integer, List<Double>> aligned = new LinkedHashMap<>();
        Map<Integer, List<Double>> misaligned = new LinkedHashMap<>();
        Map<Integer, List<Double>> alignedHits = new LinkedHashMap<>();
        int unmeasured = 0;
        int withoutEligibleRelevant = 0;
        for (JsonNode offer : truth.get("offers")) {
            UUID offerId = UUID.fromString(offer.get("offerId").asString());
            Set<UUID> groundTruth = relevantByArchetype.getOrDefault(offer.get("archetype").asString(), Set.of());
            Set<UUID> eligible = ScreeningEligiblePopulation.eligibleCandidates(jdbc, offerId,
                    settings.getModelName(), settings.getModelVersion(), settings.getStrategyVersion(),
                    SearchStatus.NOT_LOOKING.getCode());
            Set<UUID> relevant = new HashSet<>(groundTruth);
            relevant.retainAll(eligible);
            int excludedByRules = groundTruth.size() - relevant.size();
            List<UUID> ranked = screeningService.topCandidates(offerId, MAX_N).stream()
                    .map(ScreenedCandidate::candidateId).toList();
            boolean isAligned = offer.get("aligned").asBoolean();
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("offerId", offerId.toString());
            entry.put("title", offer.get("title").asString());
            entry.put("archetype", offer.get("archetype").asString());
            entry.put("aligned", isAligned);
            entry.put("relevantCount", relevant.size());
            entry.put("excludedByRules", excludedByRules);
            entry.put("returned", ranked.size());
            if (relevant.isEmpty()) {
                // Aucun pertinent éligible (déjà suggérés, sans consentement…) : non mesurable, jamais un 0.
                unmeasured++;
                withoutEligibleRelevant++;
                entry.put("measurable", false);
                offers.add(entry);
                continue;
            }
            if (ranked.isEmpty()) {
                // Offre sans vecteur (brouillon non embeddé…) : non mesurable, signalé.
                unmeasured++;
                entry.put("measurable", false);
                offers.add(entry);
                continue;
            }
            entry.put("measurable", true);
            Map<String, Double> recalls = new LinkedHashMap<>();
            for (int n : NS) {
                double recall = ScreeningRecall.recallAt(ranked, relevant, n);
                recalls.put("recall@" + n, recall);
                (isAligned ? aligned : misaligned).computeIfAbsent(n, k -> new ArrayList<>()).add(recall);
                if (isAligned) {
                    alignedHits.computeIfAbsent(n, k -> new ArrayList<>())
                            .add(ScreeningRecall.hitAt(ranked, relevant, n) ? 1.0 : 0.0);
                }
            }
            entry.put("recall", recalls);
            offers.add(entry);
        }

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("generatedAt", LocalDateTime.now().toString());
        report.put("protocol", "ground truth = same job archetype (seeds), candidates reachable (not not_looking) "
                + "and vectorized; relevant = ground truth ∩ eligible population of the offer (recruiter-visibility "
                + "consent, no application to the offer, not already suggested — same WHERE as the production query); "
                + "an offer without eligible relevant candidate is not measurable; recall@N = |TopN ∩ relevant| / "
                + "|relevant| — proxy of a proxy, not the matching top K (SPEC §8.4.8)");
        report.put("model", settings.getModelName() + "/" + settings.getModelVersion());
        report.put("strategy", settings.getStrategyVersion());
        report.put("vectorizedCandidates", vectorized.size());
        report.put("offersTotal", offers.size());
        report.put("offersUnmeasured", unmeasured);
        report.put("offersWithoutEligibleRelevant", withoutEligibleRelevant);
        report.put("alignedOffers", summary(aligned, alignedHits));
        report.put("misalignedOffers(ambiguous truth)", summary(misaligned, Map.of()));
        report.put("offers", offers);

        Path dir = Path.of(System.getProperty("screening.recall.report-dir", "../scripts/seed/results"));
        Files.createDirectories(dir);
        Path file = dir.resolve("screening-recall-"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".json");
        Files.writeString(file, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(report) + "\n",
                StandardCharsets.UTF_8);
        System.out.println("Screening recall report written to " + file.toAbsolutePath());

        // Pas de seuil ici : « satisfaisant » se fixe avec l'équipe au vu du rapport (§8.4.8).
        assertThat(vectorized).as("no vectorized candidate: run the embedding backfill first").isNotEmpty();
    }

    private Set<UUID> vectorizedCandidates() {
        return new HashSet<>(jdbc.queryForList("""
                SELECT DISTINCT l.candidate_id
                FROM normalized_profile_candidate l
                JOIN normalized_profile np ON np.normalized_profile_id = l.normalized_profile_id
                JOIN profile_embedding e ON e.normalized_profile_id = np.normalized_profile_id
                WHERE np.content IS NOT NULL
                  AND np.version = (SELECT max(n2.version) FROM normalized_profile n2
                                    JOIN normalized_profile_candidate l2
                                      ON l2.normalized_profile_id = n2.normalized_profile_id
                                    WHERE l2.candidate_id = l.candidate_id AND n2.content IS NOT NULL)
                  AND e.model_name = ? AND e.model_version = ? AND e.strategy_version = ?""", UUID.class,
                settings.getModelName(), settings.getModelVersion(), settings.getStrategyVersion()));
    }

    /** Aucun NaN dans le JSON : un groupe sans offre mesurable publie {@code null}. */
    private static Double finiteOrNull(double value) {
        return Double.isNaN(value) ? null : value;
    }

    private static Map<String, Object> summary(Map<Integer, List<Double>> recalls, Map<Integer, List<Double>> hits) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int n : NS) {
            List<Double> values = recalls.getOrDefault(n, List.of());
            Map<String, Object> stat = new LinkedHashMap<>();
            stat.put("offers", values.size());
            stat.put("meanRecall", finiteOrNull(ScreeningRecall.mean(values)));
            stat.put("minRecall", finiteOrNull(ScreeningRecall.min(values)));
            if (hits.containsKey(n)) {
                stat.put("hitRate", finiteOrNull(ScreeningRecall.mean(hits.get(n))));
            }
            out.put("N=" + n, stat);
        }
        return out;
    }
}
