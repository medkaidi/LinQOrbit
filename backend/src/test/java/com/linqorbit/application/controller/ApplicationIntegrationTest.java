package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Parcours HTTP réels des candidatures (PostgreSQL réel) — règle racine :
 * l'ordre d'insertion par étages et la chaîne de FK composites ne se valident
 * que sur la base réelle. Couvre : soumission nominale (5 types de questions),
 * reconstruction « mes candidatures », contexte sans {@code preferred},
 * retrait terminal, doublons de couple, CV d'autrui, option d'une autre offre,
 * obligatoires manquantes, invariants de base (UNIQUE, CHECK, FK composites,
 * réponses immuables — pas d'updated_at), offres indisponibles et 401.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApplicationIntegrationTest {

    private static final String APPLICATIONS_PATH = "/api/v1/applications";
    private static final String ATTACHMENTS_PATH = "/api/v1/candidates/me/attachments";

    private static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    private static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    private static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    private static final String WORK_MODE_ID = "b2000000-0000-4000-8000-000000000001";

    private static final String QUESTIONS_ALL_TYPES = """
            [
              {"label": "Why this role?", "type": "text", "isRequired": true, "sortOrder": 0},
              {"label": "Preferred setup?", "type": "single_choice", "isRequired": true, "sortOrder": 1,
               "options": [
                 {"label": "Remote", "sortOrder": 0, "preferred": false},
                 {"label": "On site", "sortOrder": 1, "preferred": true}
               ]},
              {"label": "Your stacks?", "type": "multiple_choice", "isRequired": false, "sortOrder": 2,
               "options": [
                 {"label": "Java", "sortOrder": 0, "preferred": true},
                 {"label": "Python", "sortOrder": 1, "preferred": false}
               ]},
              {"label": "Open to travel?", "type": "yes_no", "isRequired": false, "sortOrder": 3},
              {"label": "Years of experience?", "type": "number", "isRequired": false, "sortOrder": 4}
            ]""";

    private static final Path STORAGE_ROOT = createStorageRoot();

    @DynamicPropertySource
    static void storageRoot(DynamicPropertyRegistry registry) {
        registry.add("app.attachments.storage-root", () -> STORAGE_ROOT.toString());
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("linqorbit-applications-it");
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private NormalizationWorker normalizationWorker;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID candidateId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM application WHERE candidate_id = ?", candidateId);
        }
        for (UUID offerId : createdOfferIds) {
            // Les candidatures partent avant les questions (FK NO ACTION) ; les
            // réponses et sélections suivent par cascade SQL.
            jdbcTemplate.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM normalization_job j
                    USING normalized_profile_job_offer npo
                    WHERE npo.normalized_profile_id = j.job_id AND npo.job_offer_id = ?""", offerId);
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
            jdbcTemplate.update("DELETE FROM job_offer_question WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
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
    void soumissionPuisListePuisContextePuisRetraitTerminal() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID candidateId = lastUserId();
        UUID cvId = uploadCv(candidateJwt);

        UUID textQuestion = questionIdOf(offerId, "Why this role?");
        UUID singleQuestion = questionIdOf(offerId, "Preferred setup?");
        UUID multipleQuestion = questionIdOf(offerId, "Your stacks?");
        UUID yesNoQuestion = questionIdOf(offerId, "Open to travel?");
        UUID numberQuestion = questionIdOf(offerId, "Years of experience?");
        UUID remote = optionIdOf(offerId, "Remote");
        UUID java = optionIdOf(offerId, "Java");
        UUID python = optionIdOf(offerId, "Python");

        MvcResult submitted = mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [
                                    {"questionId": "%s", "text": "I love the product"},
                                    {"questionId": "%s", "optionIds": ["%s"]},
                                    {"questionId": "%s", "optionIds": ["%s", "%s"]},
                                    {"questionId": "%s", "booleanValue": true},
                                    {"questionId": "%s", "number": 7.5}
                                  ]
                                }
                                """.formatted(publicIdOf(offerId), textQuestion, singleQuestion, remote,
                                multipleQuestion, python, java, yesNoQuestion, numberQuestion)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("submitted"))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()))
                .andExpect(jsonPath("$.cv.originalName").value("candidate-cv.pdf"))
                .andExpect(jsonPath("$.job.publicId").value(publicIdOf(offerId)))
                .andExpect(jsonPath("$.job.companyName").value("Acme"))
                .andExpect(jsonPath("$.answers.length()").value(5))
                .andExpect(jsonPath("$.answers[0].type").value("text"))
                .andExpect(jsonPath("$.answers[0].value").value("I love the product"))
                .andExpect(jsonPath("$.answers[1].value.label").value("Remote"))
                .andExpect(jsonPath("$.answers[2].value.length()").value(2))
                .andExpect(jsonPath("$.answers[3].value").value(true))
                .andExpect(jsonPath("$.answers[4].value").value(7.5))
                .andReturn();
        String applicationId = objectMapper.readTree(submitted.getResponse().getContentAsString())
                .get("id").asText();

        // Base réelle : application (matching NULL), 5 réponses, 3 sélections.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM application WHERE id = ?", Integer.class, UUID.fromString(applicationId)))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT matching_id::text FROM application WHERE id = ?", String.class, UUID.fromString(applicationId)))
                .isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT cv_attachment_id::text FROM application WHERE id = ?", String.class,
                UUID.fromString(applicationId))).isEqualTo(cvId.toString());
        assertThat(count("SELECT count(*) FROM application_answer WHERE application_id = ?",
                UUID.fromString(applicationId))).isEqualTo(5);
        assertThat(count("""
                SELECT count(*) FROM application_answer_option o
                JOIN application_answer a ON a.id = o.application_answer_id
                WHERE a.application_id = ?""", UUID.fromString(applicationId))).isEqualTo(3);

        // « Mes candidatures » : ordre des questions, et `preferred` jamais exposé.
        MvcResult mine = mockMvc.perform(get(APPLICATIONS_PATH + "/mine")
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("submitted"))
                .andExpect(jsonPath("$[0].answers[0].questionId").value(textQuestion.toString()))
                .andExpect(jsonPath("$[0].answers[1].questionId").value(singleQuestion.toString()))
                .andExpect(jsonPath("$[0].answers[4].questionId").value(numberQuestion.toString()))
                .andReturn();
        assertThat(mine.getResponse().getContentAsString()).doesNotContain("preferred");

        // Contexte : questions sans preferred, candidature existante signalée.
        MvcResult context = mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicIdOf(offerId))
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(5))
                .andExpect(jsonPath("$.currentCvAttachmentId").value(cvId.toString()))
                .andExpect(jsonPath("$.existingApplication.id").value(applicationId))
                .andExpect(jsonPath("$.existingApplication.status").value("submitted"))
                .andReturn();
        assertThat(context.getResponse().getContentAsString()).doesNotContain("preferred");

        // Doublon de couple, y compris après retrait (terminal au MVP).
        assertAlreadyApplied(candidateJwt, publicIdOf(offerId));

        mockMvc.perform(post(APPLICATIONS_PATH + "/" + applicationId + "/withdraw")
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT status FROM application WHERE id = ?", Integer.class, UUID.fromString(applicationId)))
                .isEqualTo(2);
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + applicationId + "/withdraw")
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This application can no longer be withdrawn."));
        assertAlreadyApplied(candidateJwt, publicIdOf(offerId));

        mockMvc.perform(get(APPLICATIONS_PATH + "/mine").header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$[0].status").value("withdrawn"));
    }

    @Test
    void laChaineFnCompositeEstInviolableEnBase() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerA = createOffer(owner.token(), owner.companyId(), "Offer A", """
                [
                  {"label": "Setup A?", "type": "single_choice", "isRequired": false, "sortOrder": 0,
                   "options": [{"label": "Option A", "sortOrder": 0, "preferred": false}]}
                ]""");
        publish(owner.token(), offerA);
        UUID offerB = createOffer(owner.token(), owner.companyId(), "Offer B", """
                [
                  {"label": "Setup B?", "type": "single_choice", "isRequired": false, "sortOrder": 0,
                   "options": [{"label": "Option B", "sortOrder": 0, "preferred": false}]}
                ]""");
        String candidateJwt = signup();
        uploadCv(candidateJwt);

        UUID questionA = questionIdOf(offerA, "Setup A?");
        UUID optionA = optionIdOf(offerA, "Option A");
        UUID questionB = questionIdOf(offerB, "Setup B?");
        UUID optionB = optionIdOf(offerB, "Option B");

        // Refus service : option d'une autre offre (la base ne lit pas question_type,
        // la vérification d'appartenance est en service ; la FK reverrouille ensuite).
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "optionIds": ["%s"]}]
                                }
                                """.formatted(publicIdOf(offerA), questionA, optionB)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Answer for question 'Setup A?' is invalid."));

        // Refus service : le type de la question prime sur la forme envoyée.
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "text": "A"}]
                                }
                                """.formatted(publicIdOf(offerA), questionA)))
                .andExpect(status().isBadRequest());

        MvcResult submitted = mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "optionIds": ["%s"]}]
                                }
                                """.formatted(publicIdOf(offerA), questionA, optionA)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID applicationId = UUID.fromString(objectMapper.readTree(submitted.getResponse().getContentAsString())
                .get("id").asText());
        UUID answerAId = jdbcTemplate.queryForObject(
                "SELECT id FROM application_answer WHERE application_id = ?", UUID.class, applicationId);

        UUID candidateId = lastUserId();
        UUID offerAId = offerIdOf(publicIdOf(offerA));

        // FK fk_aa_question : (offre A, question de l'offre B) — la réponse
        // prétend appartenir à A mais cite une question de B → rejetée en base.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, created_at)
                VALUES (?, ?, ?, ?, now())""", UUID.randomUUID(), applicationId, offerAId, questionB))
                .isInstanceOf(DataIntegrityViolationException.class);

        // FK fk_aa_application : (offre B, candidature de l'offre A) → rejetée.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, created_at)
                VALUES (?, ?, ?, ?, now())""", UUID.randomUUID(), applicationId, offerIdOf(publicIdOf(offerB)),
                questionB))
                .isInstanceOf(DataIntegrityViolationException.class);

        // FK fk_aao_option : option de B sur une réponse de la question A → rejetée.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer_option (application_answer_id, question_id, option_id)
                VALUES (?, ?, ?)""", answerAId, questionA, optionB))
                .isInstanceOf(DataIntegrityViolationException.class);

        // UNIQUE du couple (candidat, offre) : doublon rejeté en base.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application (id, candidate_id, job_offer_id, cv_attachment_id, status, created_at,
                                         updated_at)
                VALUES (?, ?, ?, ?, 1, now(), now())""", UUID.randomUUID(), candidateId, offerAId,
                jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?", UUID.class,
                        applicationId)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reponsesImmuablesEtContraintesDeBase() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", """
                [
                  {"label": "First?", "type": "text", "isRequired": true, "sortOrder": 0},
                  {"label": "Second?", "type": "text", "isRequired": false, "sortOrder": 1}
                ]""");
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        uploadCv(candidateJwt);
        UUID first = questionIdOf(offerId, "First?");
        UUID second = questionIdOf(offerId, "Second?");

        MvcResult submitted = mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "text": "Answer"}]
                                }
                                """.formatted(publicIdOf(offerId), first)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID applicationId = UUID.fromString(objectMapper.readTree(submitted.getResponse().getContentAsString())
                .get("id").asText());
        UUID offerIdReal = offerIdOf(publicIdOf(offerId));

        // Réponses immuables : la table n'a pas d'updated_at (snapshot de soumission).
        assertThat(count("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_name = 'application_answer' AND column_name = 'updated_at'""")).isZero();

        // UNIQUE (application_id, question_id) : une réponse par question.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, answer_text,
                                                created_at)
                VALUES (?, ?, ?, ?, 'Duplicated', now())""", UUID.randomUUID(), applicationId, offerIdReal, first))
                .isInstanceOf(DataIntegrityViolationException.class);

        // CHECK num_nonnulls ≤ 1 : deux porteurs pour une même réponse.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, answer_text,
                                                answer_boolean, created_at)
                VALUES (?, ?, ?, ?, 'Text', true, now())""", UUID.randomUUID(), applicationId, offerIdReal, second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void soumissionSansQuestionsNiCvChoisiEpingleLeCvCourant() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "No Questions", null);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID cvId = uploadCv(candidateJwt);

        // `answers` absentes ≡ vides ; `cvAttachmentId` absent → CV courant.
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicIdOf(offerId) + "\", \"answers\": null}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.answers.length()").value(0))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()));

        // Contexte d'un compte sans ligne candidates : CV courant null, 200.
        String otherJwt = signup();
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicIdOf(offerId))
                        .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentCvAttachmentId").doesNotExist())
                .andExpect(jsonPath("$.existingApplication").doesNotExist());
    }

    @Test
    void obligationsEtValidationsDeSoumission() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID candidateId = lastUserId();
        uploadCv(candidateJwt);
        UUID textQuestion = questionIdOf(offerId, "Why this role?");

        // Sans CV du tout : 409 même avec des réponses valides.
        String noCvJwt = signup();
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + noCvJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicIdOf(offerId) + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("A CV is required to apply. Add one to your profile first."));

        // Question obligatoire non répondue : la seule réponse est valide, la
        // question texte obligatoire manque → refus « obligatoires ».
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "optionIds": ["%s"]}]
                                }
                                """.formatted(publicIdOf(offerId), questionIdOf(offerId, "Preferred setup?"),
                                optionIdOf(offerId, "Remote"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("All required questions must be answered."));

        // Question inconnue de l'offre.
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [{"questionId": "%s", "text": "x"}]
                                }
                                """.formatted(publicIdOf(offerId), UUID.randomUUID())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unknown question in your submission."));

        // Nombre à plus de 2 décimales refusé (NUMERIC(12,2) altérerait la réponse).
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "answers": [
                                    {"questionId": "%s", "text": "Why not"},
                                    {"questionId": "%s", "optionIds": ["%s"]},
                                    {"questionId": "%s", "number": 1.999}
                                  ]
                                }
                                """.formatted(publicIdOf(offerId), textQuestion,
                                questionIdOf(offerId, "Preferred setup?"), optionIdOf(offerId, "Remote"),
                                questionIdOf(offerId, "Years of experience?"))))
                .andExpect(status().isBadRequest());

        // CV d'un autre candidat refusé (400, le CV doit appartenir au candidat).
        String otherJwt = signup();
        UUID otherCvId = uploadCv(otherJwt);
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "cvAttachmentId": "%s"
                                }
                                """.formatted(publicIdOf(offerId), otherCvId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The selected CV is not available."));

        // Aucune candidature n'a été écrite par ces refus.
        assertThat(count("SELECT count(*) FROM application WHERE candidate_id = ?", candidateId)).isZero();
    }

    @Test
    void offresIndisponiblesEtCandidatureDAutrui() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID draftId = createOffer(owner.token(), owner.companyId(), "Draft Offer", null);
        UUID expiredId = createOffer(owner.token(), owner.companyId(), "Expired Offer", null);
        publish(owner.token(), expiredId);
        jdbcTemplate.update("UPDATE job_offer SET expires_at = CURRENT_DATE - 1 WHERE id = ?", expiredId);
        UUID closedId = createOffer(owner.token(), owner.companyId(), "Closed Offer", null);
        publish(owner.token(), closedId);
        mockMvc.perform(post("/api/v1/job-offers/" + closedId + "/close")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNoContent());

        String candidateJwt = signup();
        uploadCv(candidateJwt);
        for (UUID offerId : List.of(draftId, expiredId, closedId)) {
            mockMvc.perform(post(APPLICATIONS_PATH)
                            .header("Authorization", "Bearer " + candidateJwt)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"jobPublicId\": \"" + publicIdOf(offerId) + "\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.detail").value("This job offer is no longer available."));
            mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicIdOf(offerId))
                            .header("Authorization", "Bearer " + candidateJwt))
                    .andExpect(status().isNotFound());
        }
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"zzzzzzzzzzzz\"}"))
                .andExpect(status().isNotFound());

        // La candidature d'un autre candidat est introuvable (404, zéro fuite).
        UUID openOffer = createOffer(owner.token(), owner.companyId(), "Open Offer", null);
        publish(owner.token(), openOffer);
        MvcResult submitted = mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicIdOf(openOffer) + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String applicationId = objectMapper.readTree(submitted.getResponse().getContentAsString())
                .get("id").asText();

        String otherJwt = signup();
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + applicationId + "/withdraw")
                        .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(APPLICATIONS_PATH + "/mine").header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void sansJetonToutEst401() throws Exception {
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"abc123def456\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(APPLICATIONS_PATH + "/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/abc123def456")).andExpect(status().isUnauthorized());
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + UUID.randomUUID() + "/withdraw"))
                .andExpect(status().isUnauthorized());
    }

    private void assertAlreadyApplied(String token, String publicId) throws Exception {
        mockMvc.perform(post(APPLICATIONS_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicId + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You have already applied to this job offer."));
    }

    private int count(String sql, Object... args) {
        return jdbcTemplate.queryForObject(sql, Integer.class, args);
    }

    private UUID questionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT id FROM job_offer_question WHERE job_offer_id = ? AND label = ?""", UUID.class, offerId,
                label);
    }

    private UUID optionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT o.id FROM job_offer_question_option o
                JOIN job_offer_question q ON q.id = o.question_id
                WHERE q.job_offer_id = ? AND o.label = ?""", UUID.class, offerId, label);
    }

    private UUID offerIdOf(String publicId) {
        return jdbcTemplate.queryForObject("SELECT id FROM job_offer WHERE public_id = ?", UUID.class, publicId);
    }

    private String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private UUID uploadCv(String token) throws Exception {
        MvcResult result = mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "candidate-cv.pdf", "application/pdf",
                                "%PDF-1.4 candidate".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    /** Recruteur propriétaire et sa société : jeton + companyId en main. */
    private record Owner(String token, UUID companyId) {
    }

    private Owner ownerWithCompany(String companyName) throws Exception {
        String token = signup();
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + companyName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);
        return new Owner(token, companyId);
    }

    /**
     * Offre draft avec les références minimales ; {@code questionsArrayJson}
     * nul ou vide → pas de clé {@code questions} du tout (un tableau vide ou
     * absent ≡ aucune question).
     */
    private UUID createOffer(String token, UUID companyId, String title, String questionsArrayJson) throws Exception {
        String questions = questionsArrayJson == null || questionsArrayJson.isBlank()
                ? ""
                : ",\n  \"questions\": " + questionsArrayJson;
        MvcResult result = mockMvc.perform(post("/api/v1/job-offers")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "%s",
                                  "description": "Build and own our platform APIs.",
                                  "seniority": "mid",
                                  "city": "Paris",
                                  "country": "FR",
                                  "contractTypeId": "%s",
                                  "employmentTypeId": "%s",
                                  "workModeId": "%s",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory", "weight": 4}
                                  ]%s
                                }
                                """.formatted(companyId, title, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID, WORK_MODE_ID,
                                SKILL_ID, questions)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdOfferIds.add(offerId);
        return offerId;
    }

    private void publish(String token, UUID offerId) throws Exception {
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/job-offers/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String signup() throws Exception {
        String email = "application-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType("application/json")
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

    private UUID lastUserId() {
        return createdUserIds.get(createdUserIds.size() - 1);
    }
}
