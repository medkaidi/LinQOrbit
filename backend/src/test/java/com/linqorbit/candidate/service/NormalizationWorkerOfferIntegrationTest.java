package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.linqorbit.embedding.service.EmbeddingService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.joboffer.client.JobOfferNormalizeClient;
import com.linqorbit.joboffer.dto.OfferNormalizeRequest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Branche offre du worker unique contre PostgreSQL : validate → job OFFER →
 * exécution synchrone (client IA mocké) → contenu écrit + DONE. L'exécuteur
 * est remplacé par un mock inerte : aucun dispatch asynchrone réel, les
 * appels à {@code executeJob()} sont manuels et déterministes.
 */
@SpringBootTest
@AutoConfigureMockMvc
class NormalizationWorkerOfferIntegrationTest {

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String CANONICAL_OFFER_JSON =
            "{\"schemaVersion\": \"2\", \"title\": \"Backend Engineer\","
                    + " \"requiredSkills\": [], \"preferredSkills\": []}";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private NormalizationWorker normalizationWorker;

    @MockitoBean
    private JobOfferNormalizeClient jobOfferNormalizeClient;
    @MockitoBean(name = "normalizationExecutor")
    private ThreadPoolTaskExecutor normalizationExecutor;
    @MockitoBean(name = "normalizationTaskScheduler")
    private TaskScheduler normalizationTaskScheduler;
    /** Inerte : l'embedding est couvert par EmbeddingIntegrationTest, ici aucune ligne embedding_job ne doit naître. */
    @MockitoBean
    private EmbeddingService embeddingService;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_job_offer npo
                    WHERE npo.normalized_profile_id = j.job_id AND npo.job_offer_id = ?""", offerId);
            // La publication crée un job de screening (FK vers la fiche, T-101) : à retirer avant les fiches.
            jdbcTemplate.update("DELETE FROM screening_job WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM normalized_profile_job_offer WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM normalized_profile np
                    WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                       WHERE npc.normalized_profile_id = np.normalized_profile_id)
                      AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                       WHERE npo.normalized_profile_id = np.normalized_profile_id)""");
            jdbcTemplate.update("DELETE FROM job_offer_skill WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_language WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_degree WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_study_field WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        for (UUID companyId : createdCompanyIds) {
            jdbcTemplate.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        createdOfferIds.clear();
        createdUserIds.clear();
        createdCompanyIds.clear();
    }

    @Test
    void validateCreeUnJobOfferPuisExecuteEcritLeContenuEtMarqueDone() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        createdOfferIds.add(offerId);
        ArgumentCaptor<OfferNormalizeRequest> requestCaptor =
                ArgumentCaptor.forClass(OfferNormalizeRequest.class);
        when(jobOfferNormalizeClient.normalize(requestCaptor.capture()))
                .thenReturn(CANONICAL_OFFER_JSON);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        UUID jobId = latestOfferJobId(offerId);
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("validated"))
                .andExpect(jsonPath("$.normalizationInProgress").value(true))
                .andExpect(jsonPath("$.normalizationFailed").value(false));

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT j.status, j.source_type, np.content FROM normalization_job j"
                        + " JOIN normalized_profile np ON np.normalized_profile_id = j.job_id"
                        + " WHERE j.job_id = ?", jobId);
        assertThat(NormalizationJobStatus.fromCode(((Number) row.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.DONE);
        // Enum SMALLINT : 2 = OFFER (le worker a branché sur source_type).
        assertThat(((Number) row.get("source_type")).intValue()).isEqualTo(2);
        assertThat(String.valueOf(row.get("content"))).contains("\"schemaVersion\": \"2\"");

        OfferNormalizeRequest sent = requestCaptor.getValue();
        assertThat(sent.offer().title()).isEqualTo("Backend Engineer");
        // Description HTML strippée avant l'envoi au LLM.
        assertThat(sent.offer().description()).isEqualTo("Own the public API.");
        assertThat(sent.offer().contractTypeLabel()).isEqualTo("Permanent");
        assertThat(sent.offer().company().description()).isEqualTo("We build payments.");
        assertThat(sent.offer().skills()).hasSize(1);
        assertThat(sent.offer().skills().get(0).requirementType()).isEqualTo("mandatory");

        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationInProgress").value(false))
                .andExpect(jsonPath("$.normalizationFailed").value(false));
        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].normalizationInProgress").value(false));
    }

    @Test
    void doubleValidateNeCreePasDeuxVersions() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        createdOfferIds.add(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        // L'exécuteur est inerte : le job reste PENDING, le second validate
        // doit retomber sur le no-op (aucune seconde version).
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        Integer versions = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM normalized_profile_job_offer WHERE job_offer_id = ?",
                Integer.class, offerId);
        assertThat(versions).isEqualTo(1);
    }

    // --- D63 : garde du schemaVersion, analyse obsolète de l'offre -----------

    @Test
    void jsonIaALaVersionCandidatEstRefusePourUneOffreSansEcriture() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID offerId = createOffer(token, createCompany(token));
        createdOfferIds.add(offerId);
        // "3" est la version candidat : jamais comparée à la version offre "2".
        when(jobOfferNormalizeClient.normalize(any())).thenReturn("{\"schemaVersion\": \"3\", \"title\": \"X\"}");
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        UUID jobId = latestOfferJobId(offerId);

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT j.status, j.attempts, j.error, np.content FROM normalization_job j"
                        + " JOIN normalized_profile np ON np.normalized_profile_id = j.job_id"
                        + " WHERE j.job_id = ?", jobId);
        assertThat(NormalizationJobStatus.fromCode(((Number) row.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(((Number) row.get("attempts")).intValue()).isEqualTo(1);
        assertThat(row.get("error")).isEqualTo("The AI service returned schemaVersion 3, expected 2.");
        assertThat(row.get("content")).isNull();
    }

    @Test
    void analyseObsoleteSignaleeEnDetailEtEnListePuisRevalidableSansModification() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID outdatedId = createOffer(token, companyId);
        UUID currentId = createOffer(token, companyId);
        UUID neverValidatedId = createOffer(token, companyId);
        createdOfferIds.addAll(List.of(outdatedId, currentId, neverValidatedId));
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        for (UUID offerId : List.of(outdatedId, currentId)) {
            mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isNoContent());
            normalizationWorker.executeJob(latestOfferJobId(offerId));
        }
        // Fiche produite avant une montée de version (schéma « 1 »).
        UUID firstSheet = latestOfferJobId(outdatedId);
        jdbcTemplate.update("""
                UPDATE normalized_profile SET schema_version = '1', content = '{"schemaVersion": "1"}'::jsonb
                WHERE normalized_profile_id = ?""", firstSheet);

        // Liste : une seule requête pour toutes les lignes, offre jamais validée → false.
        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '%s')].analysisOutdated".formatted(outdatedId))
                        .value(Matchers.contains(true)))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].analysisOutdated".formatted(currentId))
                        .value(Matchers.contains(false)))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].analysisOutdated".formatted(neverValidatedId))
                        .value(Matchers.contains(false)));
        expectOfferSignals(token, outdatedId, false, true);
        expectOfferSignals(token, currentId, false, false);

        // Offre à jour et sans changement : la validation reste un no-op.
        mockMvc.perform(post("/api/v1/job-offers/" + currentId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(currentId)).isEqualTo(1);

        // Fiche obsolète : relance sans aucune modification de l'offre.
        mockMvc.perform(post("/api/v1/job-offers/" + outdatedId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(outdatedId)).isEqualTo(2);
        UUID secondSheet = latestOfferJobId(outdatedId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT schema_version FROM normalized_profile WHERE normalized_profile_id = ?",
                String.class, secondSheet)).isEqualTo("2");
        // La référence reste la v1 tant que la v2 n'a pas de contenu.
        expectOfferSignals(token, outdatedId, true, true);

        // Double-clic pendant l'analyse : no-op.
        mockMvc.perform(post("/api/v1/job-offers/" + outdatedId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(outdatedId)).isEqualTo(2);

        normalizationWorker.executeJob(secondSheet);
        expectOfferSignals(token, outdatedId, false, false);
    }

    @Test
    void offrePublieeObsoleteSeRevalideSansChangerSonCycleDeVie() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        UUID validatedId = createOffer(token, companyId);
        createdOfferIds.addAll(List.of(offerId, validatedId));
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        for (UUID id : List.of(offerId, validatedId)) {
            mockMvc.perform(post("/api/v1/job-offers/" + id + "/validate").header("Authorization", "Bearer " + token))
                    .andExpect(status().isNoContent());
            normalizationWorker.executeJob(latestOfferJobId(id));
        }
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        // Fiche produite avant une montée de version (schéma « 1 ») — offre de test dédiée.
        jdbcTemplate.update("""
                UPDATE normalized_profile SET schema_version = '1', content = '{"schemaVersion": "1"}'::jsonb
                WHERE normalized_profile_id = ?""", latestOfferJobId(offerId));

        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '%s')].status".formatted(offerId))
                        .value(Matchers.contains("published")))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].analysisOutdated".formatted(offerId))
                        .value(Matchers.contains(true)));
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("published"))
                .andExpect(jsonPath("$.analysisOutdated").value(true));
        Map<String, Object> lifecycle = offerLifecycle(offerId);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(versionCount(offerId)).isEqualTo(2);
        UUID refreshedSheet = latestOfferJobId(offerId);
        Map<String, Object> sheet = jdbcTemplate.queryForMap("""
                SELECT np.schema_version, np.content, j.status FROM normalized_profile np
                JOIN normalization_job j ON j.job_id = np.normalized_profile_id
                WHERE np.normalized_profile_id = ?""", refreshedSheet);
        assertThat(sheet.get("schema_version")).isEqualTo("2");
        assertThat(sheet.get("content")).isNull();
        assertThat(NormalizationJobStatus.fromCode(((Number) sheet.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.PENDING);
        // Cycle de vie intact : statut, publishedAt, validatedAt et updatedAt inchangés.
        assertThat(offerLifecycle(offerId)).isEqualTo(lifecycle);

        // Second appel pendant l'analyse : no-op, une seule nouvelle version.
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(offerId)).isEqualTo(2);

        normalizationWorker.executeJob(refreshedSheet);
        assertThat(String.valueOf(jdbcTemplate.queryForObject(
                "SELECT content FROM normalized_profile WHERE normalized_profile_id = ?", String.class,
                refreshedSheet))).contains("\"schemaVersion\": \"2\"");
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("published"))
                .andExpect(jsonPath("$.analysisOutdated").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(false));

        // Fiche courante : no-op (publish a posé updatedAt après la validation — jamais « sale »).
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(offerId)).isEqualTo(2);
        assertThat(offerLifecycle(offerId)).isEqualTo(lifecycle);

        // DRAFT/VALIDATED passent par /validate ; CLOSED est terminal : 409 sans nouvelle version.
        mockMvc.perform(post("/api/v1/job-offers/" + validatedId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/close").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This action is not allowed from the offer's current status."));
        assertThat(versionCount(offerId)).isEqualTo(2);
        assertThat(versionCount(validatedId)).isEqualTo(1);
    }

    @Test
    void offrePublieeSansFicheEstSignaleeObsoletePuisSaFicheEstGenereeParRevalidate() throws Exception {
        // T-88 : offre PUBLISHED sans aucune fiche (legacy / corruption).
        String token = signup();
        becomeRecruiter(token);
        UUID companyId = createCompany(token);
        UUID offerId = createOffer(token, companyId);
        createdOfferIds.add(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        normalizationWorker.executeJob(latestOfferJobId(offerId));
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        // Suppression de la fiche de cette offre seulement.
        UUID sheetId = latestOfferJobId(offerId);
        jdbcTemplate.update("DELETE FROM normalization_job WHERE job_id = ?", sheetId);
        jdbcTemplate.update("DELETE FROM screening_job WHERE offer_normalized_profile_id = ?", sheetId);
        jdbcTemplate.update("DELETE FROM normalized_profile_job_offer WHERE normalized_profile_id = ?", sheetId);
        jdbcTemplate.update("DELETE FROM normalized_profile WHERE normalized_profile_id = ?", sheetId);
        assertThat(versionCount(offerId)).isZero();

        mockMvc.perform(get("/api/v1/job-offers").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '%s')].analysisOutdated".formatted(offerId))
                        .value(Matchers.contains(true)));
        expectOfferSignals(token, offerId, false, true);
        Map<String, Object> lifecycle = offerLifecycle(offerId);

        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(versionCount(offerId)).isEqualTo(1);
        UUID generatedSheet = latestOfferJobId(offerId);
        Map<String, Object> sheet = jdbcTemplate.queryForMap("""
                SELECT np.version, np.schema_version, np.content, j.status FROM normalized_profile np
                JOIN normalization_job j ON j.job_id = np.normalized_profile_id
                WHERE np.normalized_profile_id = ?""", generatedSheet);
        assertThat(((Number) sheet.get("version")).intValue()).isEqualTo(1);
        assertThat(sheet.get("schema_version")).isEqualTo("2");
        assertThat(sheet.get("content")).isNull();
        assertThat(NormalizationJobStatus.fromCode(((Number) sheet.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(offerLifecycle(offerId)).isEqualTo(lifecycle);
        expectOfferSignals(token, offerId, true, false);

        // Second appel pendant l'analyse : no-op.
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/revalidate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        assertThat(versionCount(offerId)).isEqualTo(1);

        normalizationWorker.executeJob(generatedSheet);
        assertThat(String.valueOf(jdbcTemplate.queryForObject(
                "SELECT content FROM normalized_profile WHERE normalized_profile_id = ?", String.class,
                generatedSheet))).contains("\"schemaVersion\": \"2\"");
        expectOfferSignals(token, offerId, false, false);
        assertThat(offerLifecycle(offerId)).isEqualTo(lifecycle);
    }

    // --- D64 : flux SSE du statut de normalisation de l'offre -----------------

    @Test
    void fluxSseDeLOffreSuitLaValidationPuisLeWorkerJusquAuTerminal() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID offerId = createOffer(token, createCompany(token));
        createdOfferIds.add(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        MvcResult stream = openOfferStream(token, offerId);
        assertThat(stream.getResponse().getContentAsString()).contains("\"status\":\"pending\"");

        normalizationWorker.executeJob(latestOfferJobId(offerId));

        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());
        String body = stream.getResponse().getContentAsString();
        assertThat(body).contains("event:status");
        int pending = body.indexOf("\"status\":\"pending\"");
        int running = body.indexOf("\"status\":\"running\"");
        int done = body.indexOf("\"status\":\"done\"");
        assertThat(pending).isNotNegative().isLessThan(running);
        assertThat(running).isLessThan(done);
        // Signal seulement : jamais le contenu de la fiche.
        assertThat(body).doesNotContain("Backend Engineer");

        // Analyse déjà terminée à l'abonnement : le statut final est envoyé puis le flux se ferme.
        MvcResult replay = openOfferStream(token, offerId);
        mockMvc.perform(asyncDispatch(replay)).andExpect(status().isOk());
        assertThat(replay.getResponse().getContentAsString()).contains("\"status\":\"done\"")
                .doesNotContain("\"status\":\"pending\"");
    }

    @Test
    void unEchecIaRepasseEnAttenteSansFermerLeFluxEtSansFaireEchouerLeJob() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID offerId = createOffer(token, createCompany(token));
        createdOfferIds.add(offerId);
        when(jobOfferNormalizeClient.normalize(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."));
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        MvcResult stream = openOfferStream(token, offerId);

        UUID jobId = latestOfferJobId(offerId);
        normalizationWorker.executeJob(jobId);

        String body = stream.getResponse().getContentAsString();
        assertThat(body).contains("\"status\":\"running\"");
        assertThat(body.lastIndexOf("\"status\":\"pending\"")).isGreaterThan(body.indexOf("\"status\":\"running\""));
        assertThat(stream.getRequest().isAsyncStarted()).isTrue();
        assertThat(((Number) jdbcTemplate.queryForObject(
                "SELECT attempts FROM normalization_job WHERE job_id = ?", Integer.class, jobId)).intValue())
                .isEqualTo(1);
    }

    @Test
    void fluxSseDeLOffreRefuseSansJetonHorsCompanyEtSansProfilRecruteur() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID offerId = createOffer(token, createCompany(token));
        createdOfferIds.add(offerId);
        String eventsPath = "/api/v1/job-offers/" + offerId + "/normalization/events";

        mockMvc.perform(get(eventsPath).accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized())
                .andExpect(request().asyncNotStarted());

        // Recruteur d'une autre company : même 404 qu'en lecture, aucune fuite d'existence.
        String outsider = signup();
        becomeRecruiter(outsider);
        createCompany(outsider);
        mockMvc.perform(get(eventsPath).header("Authorization", "Bearer " + outsider)
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound())
                .andExpect(request().asyncNotStarted());
        mockMvc.perform(get("/api/v1/job-offers/" + UUID.randomUUID() + "/normalization/events")
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound())
                .andExpect(request().asyncNotStarted());

        // Compte sans profil recruteur : refusé avant toute ouverture de flux.
        String candidateOnly = signup();
        mockMvc.perform(get(eventsPath).header("Authorization", "Bearer " + candidateOnly)
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound())
                .andExpect(request().asyncNotStarted());

        // Offre jamais validée : « none », flux aussitôt fermé.
        MvcResult stream = openOfferStream(token, offerId);
        mockMvc.perform(asyncDispatch(stream)).andExpect(status().isOk());
        assertThat(stream.getResponse().getContentAsString()).contains("\"status\":\"none\"");
    }

    // --- T-64 : déclencheur de l'embedding après le DONE ----------------------

    @Test
    void uneNormalisationReussieDeclencheLEmbeddingDeLOffreUneFoisEtApresLeDone() throws Exception {
        UUID offerId = validatedOffer();
        UUID jobId = latestOfferJobId(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        AtomicReference<Map<String, Object>> rowAtTrigger = new AtomicReference<>();
        doAnswer(invocation -> {
            rowAtTrigger.set(jobWithContent(jobId));
            return null;
        }).when(embeddingService).enqueueAndDispatch(jobId);

        normalizationWorker.executeJob(jobId);

        verify(embeddingService, times(1)).enqueueAndDispatch(jobId);
        // Déclenché une fois la tx « content + DONE » commitée : jamais sur une fiche sans contenu.
        assertThat(NormalizationJobStatus.fromCode(((Number) rowAtTrigger.get().get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.DONE);
        assertThat(rowAtTrigger.get().get("content")).isNotNull();
    }

    @Test
    void unEchecIaOuUneFicheRefuseeNeDeclencheJamaisLEmbeddingDeLOffre() throws Exception {
        UUID offerId = validatedOffer();
        UUID jobId = latestOfferJobId(offerId);
        when(jobOfferNormalizeClient.normalize(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed."))
                .thenReturn("{\"schemaVersion\": \"3\", \"title\": \"X\"}");

        normalizationWorker.executeJob(jobId);
        normalizationWorker.executeJob(jobId);

        verify(embeddingService, never()).enqueueAndDispatch(jobId);
    }

    @Test
    void uneErreurDeLEmbeddingNeFaitJamaisPerdreLaNormalisationValideDeLOffre() throws Exception {
        UUID offerId = validatedOffer();
        UUID jobId = latestOfferJobId(offerId);
        when(jobOfferNormalizeClient.normalize(any())).thenReturn(CANONICAL_OFFER_JSON);
        doThrow(new IllegalStateException("embedding indisponible")).when(embeddingService)
                .enqueueAndDispatch(jobId);

        normalizationWorker.executeJob(jobId);

        Map<String, Object> row = jobWithContent(jobId);
        assertThat(NormalizationJobStatus.fromCode(((Number) row.get("status")).shortValue()))
                .isEqualTo(NormalizationJobStatus.DONE);
        assertThat(row.get("content")).isNotNull();
        assertThat(((Number) row.get("attempts")).intValue()).isZero();
        verify(jobOfferNormalizeClient, times(1)).normalize(any());
    }

    /** Offre créée puis validée : son job de normalisation est PENDING (exécuteur inerte). */
    private UUID validatedOffer() throws Exception {
        String token = signup();
        becomeRecruiter(token);
        UUID offerId = createOffer(token, createCompany(token));
        createdOfferIds.add(offerId);
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        return offerId;
    }

    private Map<String, Object> jobWithContent(UUID jobId) {
        return jdbcTemplate.queryForMap(
                "SELECT j.status, j.attempts, np.content FROM normalization_job j"
                        + " JOIN normalized_profile np ON np.normalized_profile_id = j.job_id"
                        + " WHERE j.job_id = ?", jobId);
    }

    private MvcResult openOfferStream(String token, UUID offerId) throws Exception {
        return mockMvc.perform(get("/api/v1/job-offers/" + offerId + "/normalization/events")
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    /** Statut et dates de vie de l'offre, lus en base. */
    private Map<String, Object> offerLifecycle(UUID offerId) {
        return jdbcTemplate.queryForMap(
                "SELECT status, published_at, validated_at, updated_at FROM job_offer WHERE id = ?", offerId);
    }

    private void expectOfferSignals(String token, UUID offerId, boolean inProgress, boolean outdated)
            throws Exception {
        mockMvc.perform(get("/api/v1/job-offers/" + offerId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.normalizationInProgress").value(inProgress))
                .andExpect(jsonPath("$.normalizationFailed").value(false))
                .andExpect(jsonPath("$.analysisOutdated").value(outdated));
    }

    private int versionCount(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT count(*) FROM normalized_profile_job_offer WHERE job_offer_id = ?", Integer.class, offerId);
    }

    /** Job de la dernière version de l'offre (job_id ≡ normalized_profile_id). */
    private UUID latestOfferJobId(UUID offerId) {
        return jdbcTemplate.queryForObject(
                "SELECT j.job_id FROM normalization_job j"
                        + " JOIN normalized_profile_job_offer npo ON npo.normalized_profile_id = j.job_id"
                        + " JOIN normalized_profile np ON np.normalized_profile_id = j.job_id"
                        + " WHERE npo.job_offer_id = ? ORDER BY np.version DESC LIMIT 1", UUID.class, offerId);
    }

    private UUID createOffer(String token, UUID companyId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "description": "<p>Own the <strong>public API</strong>.</p>",
                                  "city": "Paris",
                                  "country": "FR",
                                  "contractTypeId": "%s",
                                  "employmentTypeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ]
                                }
                                """.formatted(companyId, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID, SKILL_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
    }

    private UUID createCompany(String token) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\", \"description\": \"We build payments.\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);
        return companyId;
    }

    private void becomeRecruiter(String token) throws Exception {
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
    }

    private String signup() throws Exception {
        String email = "offer-worker-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Ada",
                                  "lastName": "Lovelace",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }
}
