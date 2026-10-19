package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Parcours HTTP réels des candidatures (PostgreSQL réel) — règle racine :
 * l'ordre d'insertion par étages et la chaîne de FK composites ne se valident
 * que sur la base réelle. Couvre le parcours en brouillon (D59) : brouillon
 * nominal (5 types de questions), remplacement des réponses et brouillon
 * partiel, étape calculée du contexte, transmission (CV renseigné puis
 * épinglé), abandon, retrait terminal, doublons de couple, CV d'autrui, option
 * d'une autre offre, obligatoires manquantes, invariants de base (UNIQUE,
 * CHECK, FK composites, contraintes V21 — statuts 1–5, CV obligatoire hors
 * brouillon, FK matching_id), offres indisponibles et 401.
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
    void brouillonPuisTransmissionPuisListeContexteEtRetraitTerminal() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID cvId = uploadCv(candidateJwt);
        String publicId = publicIdOf(offerId);

        UUID textQuestion = questionIdOf(offerId, "Why this role?");
        UUID singleQuestion = questionIdOf(offerId, "Preferred setup?");
        UUID multipleQuestion = questionIdOf(offerId, "Your stacks?");
        UUID yesNoQuestion = questionIdOf(offerId, "Open to travel?");
        UUID numberQuestion = questionIdOf(offerId, "Years of experience?");
        UUID remote = optionIdOf(offerId, "Remote");
        UUID java = optionIdOf(offerId, "Java");
        UUID python = optionIdOf(offerId, "Python");

        // Contexte avant tout brouillon : étape « questions du recruteur ».
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.step").value("recruiter_questions"))
                .andExpect(jsonPath("$.canSubmit").value(false))
                .andExpect(jsonPath("$.answers.length()").value(0));

        MvcResult drafted = saveDraft(candidateJwt, publicId, """
                [
                  {"questionId": "%s", "text": "I love the product"},
                  {"questionId": "%s", "optionIds": ["%s"]},
                  {"questionId": "%s", "optionIds": ["%s", "%s"]},
                  {"questionId": "%s", "booleanValue": true},
                  {"questionId": "%s", "number": 7.5}
                ]""".formatted(textQuestion, singleQuestion, remote, multipleQuestion, python, java, yesNoQuestion,
                numberQuestion))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()))
                .andExpect(jsonPath("$.job.companyName").value("Acme"))
                .andExpect(jsonPath("$.answers.length()").value(5))
                .andExpect(jsonPath("$.answers[1].value.label").value("Remote"))
                .andExpect(jsonPath("$.answers[2].value.length()").value(2))
                .andExpect(jsonPath("$.answers[4].value").value(7.5))
                .andReturn();
        UUID applicationId = idOf(drafted);

        // Base réelle : brouillon (code 1), CV courant renseigné, 5 réponses, 3 sélections.
        assertThat(statusOf(applicationId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT cv_attachment_id::text FROM application WHERE id = ?",
                String.class, applicationId)).isEqualTo(cvId.toString());
        assertThat(count("SELECT count(*) FROM application_answer WHERE application_id = ?", applicationId))
                .isEqualTo(5);
        assertThat(count("""
                SELECT count(*) FROM application_answer_option o
                JOIN application_answer a ON a.id = o.application_answer_id
                WHERE a.application_id = ?""", applicationId)).isEqualTo(3);

        // Contexte : brouillon complet → matching ouvert, transmission possible, réponses rendues sans preferred.
        MvcResult context = mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId)
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.existingApplication.id").value(applicationId.toString()))
                .andExpect(jsonPath("$.existingApplication.status").value("draft"))
                .andExpect(jsonPath("$.existingApplication.cvAttachmentId").value(cvId.toString()))
                .andExpect(jsonPath("$.answers.length()").value(5))
                .andExpect(jsonPath("$.step").value("matching"))
                .andExpect(jsonPath("$.canSubmit").value(true))
                .andReturn();
        assertThat(context.getResponse().getContentAsString()).doesNotContain("preferred");

        submit(candidateJwt, applicationId, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("submitted"))
                .andExpect(jsonPath("$.cv.originalName").value("candidate-cv.pdf"))
                .andExpect(jsonPath("$.answers.length()").value(5));
        assertThat(statusOf(applicationId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT matching_id::text FROM application WHERE id = ?",
                String.class, applicationId)).isNull();

        MvcResult mine = mockMvc.perform(get(APPLICATIONS_PATH + "/mine").header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("submitted"))
                .andExpect(jsonPath("$[0].answers[0].questionId").value(textQuestion.toString()))
                .andExpect(jsonPath("$[0].answers[4].questionId").value(numberQuestion.toString()))
                .andReturn();
        assertThat(mine.getResponse().getContentAsString()).doesNotContain("preferred");
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$.step").value("submitted"))
                .andExpect(jsonPath("$.canSubmit").value(false));

        // Transmise : plus de brouillon, plus de seconde transmission, plus d'abandon.
        assertAlreadyApplied(candidateJwt, publicId);
        submit(candidateJwt, applicationId, null).andExpect(status().isConflict());
        mockMvc.perform(delete(APPLICATIONS_PATH + "/" + applicationId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isConflict());

        // Retrait terminal (code 3), le couple reste occupé.
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + applicationId + "/withdraw")
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isNoContent());
        assertThat(statusOf(applicationId)).isEqualTo(3);
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + applicationId + "/withdraw")
                        .header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This application can no longer be withdrawn."));
        assertAlreadyApplied(candidateJwt, publicId);
        mockMvc.perform(get(APPLICATIONS_PATH + "/mine").header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$[0].status").value("withdrawn"));
        // Une candidature retirée reste à l'étape « submitted » (parcours clos).
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$.step").value("submitted"))
                .andExpect(jsonPath("$.canSubmit").value(false));
    }

    @Test
    void leBrouillonRemplaceSesReponsesEtPeutEtrePartiel() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        uploadCv(candidateJwt);
        String publicId = publicIdOf(offerId);
        UUID textQuestion = questionIdOf(offerId, "Why this role?");
        UUID singleQuestion = questionIdOf(offerId, "Preferred setup?");
        UUID multipleQuestion = questionIdOf(offerId, "Your stacks?");

        // Brouillon partiel (l'obligatoire « Preferred setup? » manque) : accepté.
        UUID applicationId = idOf(saveDraft(candidateJwt, publicId, """
                [
                  {"questionId": "%s", "text": "First version"},
                  {"questionId": "%s", "optionIds": ["%s", "%s"]}
                ]""".formatted(textQuestion, multipleQuestion, optionIdOf(offerId, "Java"),
                optionIdOf(offerId, "Python")))
                .andExpect(status().isOk())
                .andReturn());
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$.step").value("recruiter_questions"))
                .andExpect(jsonPath("$.canSubmit").value(false));
        submit(candidateJwt, applicationId, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("All required questions must be answered."));

        // Ré-enregistrement : même candidature, réponses remplacées (sélections du QCM purgées en cascade).
        UUID sameId = idOf(saveDraft(candidateJwt, publicId, """
                [
                  {"questionId": "%s", "text": "Second version"},
                  {"questionId": "%s", "optionIds": ["%s"]}
                ]""".formatted(textQuestion, singleQuestion, optionIdOf(offerId, "Remote")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(2))
                .andExpect(jsonPath("$.answers[0].value").value("Second version"))
                .andReturn());
        assertThat(sameId).isEqualTo(applicationId);
        assertThat(count("SELECT count(*) FROM application WHERE candidate_id = ?", lastUserId())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM application_answer WHERE application_id = ?", applicationId))
                .isEqualTo(2);
        assertThat(count("""
                SELECT count(*) FROM application_answer_option o
                JOIN application_answer a ON a.id = o.application_answer_id
                WHERE a.application_id = ?""", applicationId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM application_answer WHERE question_id = ?", multipleQuestion)).isZero();

        // Obligatoires désormais répondues : étape matching, transmission acceptée.
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(jsonPath("$.step").value("matching"))
                .andExpect(jsonPath("$.canSubmit").value(true));
        submit(candidateJwt, applicationId, null).andExpect(status().isOk());
    }

    @Test
    void laChaineFkCompositeEtLesContraintesV21SontInviolablesEnBase() throws Exception {
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

        // Refus service : option d'une autre offre, puis forme contraire au type de la question.
        saveDraft(candidateJwt, publicIdOf(offerA),
                "[{\"questionId\": \"%s\", \"optionIds\": [\"%s\"]}]".formatted(questionA, optionB))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Answer for question 'Setup A?' is invalid."));
        saveDraft(candidateJwt, publicIdOf(offerA), "[{\"questionId\": \"%s\", \"text\": \"A\"}]".formatted(questionA))
                .andExpect(status().isBadRequest());

        UUID applicationId = idOf(saveDraft(candidateJwt, publicIdOf(offerA),
                "[{\"questionId\": \"%s\", \"optionIds\": [\"%s\"]}]".formatted(questionA, optionA))
                .andExpect(status().isOk())
                .andReturn());
        UUID answerAId = jdbcTemplate.queryForObject(
                "SELECT id FROM application_answer WHERE application_id = ?", UUID.class, applicationId);
        UUID candidateId = lastUserId();
        UUID offerAId = offerA;
        UUID cvId = jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?", UUID.class,
                applicationId);

        // FK fk_aa_question : (offre A, question de l'offre B) → rejetée en base.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, created_at)
                VALUES (?, ?, ?, ?, now())""", UUID.randomUUID(), applicationId, offerAId, questionB))
                .isInstanceOf(DataIntegrityViolationException.class);
        // FK fk_aa_application : (offre B, candidature de l'offre A) → rejetée.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, created_at)
                VALUES (?, ?, ?, ?, now())""", UUID.randomUUID(), applicationId, offerB, questionB))
                .isInstanceOf(DataIntegrityViolationException.class);
        // FK fk_aao_option : option de B sur une réponse de la question A → rejetée.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer_option (application_answer_id, question_id, option_id)
                VALUES (?, ?, ?)""", answerAId, questionA, optionB))
                .isInstanceOf(DataIntegrityViolationException.class);
        // UNIQUE du couple (candidat, offre), brouillon compris.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application (id, candidate_id, job_offer_id, cv_attachment_id, status, created_at,
                                         updated_at)
                VALUES (?, ?, ?, ?, 1, now(), now())""", UUID.randomUUID(), candidateId, offerAId, cvId))
                .isInstanceOf(DataIntegrityViolationException.class);

        // V21 — CHECK statut 1–5.
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE application SET status = 6 WHERE id = ?", applicationId))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE application SET status = 0 WHERE id = ?", applicationId))
                .isInstanceOf(DataIntegrityViolationException.class);
        // V21 — seul un brouillon peut être sans CV.
        jdbcTemplate.update("UPDATE application SET cv_attachment_id = NULL WHERE id = ?", applicationId);
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE application SET status = 2 WHERE id = ?", applicationId))
                .isInstanceOf(DataIntegrityViolationException.class);
        // V21 — FK composite matching_id : un matching inexistant (ou d'un autre couple) est impossible.
        assertThatThrownBy(() -> jdbcTemplate.update("UPDATE application SET matching_id = ? WHERE id = ?",
                UUID.randomUUID(), applicationId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reponsesFigeesALaTransmissionEtContraintesDeBase() throws Exception {
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

        UUID applicationId = apply(candidateJwt, publicIdOf(offerId),
                "[{\"questionId\": \"%s\", \"text\": \"Answer\"}]".formatted(first));

        // Réponses immuables après transmission : la table n'a pas d'updated_at.
        assertThat(count("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_name = 'application_answer' AND column_name = 'updated_at'""")).isZero();
        // UNIQUE (application_id, question_id) : une réponse par question.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, answer_text,
                                                created_at)
                VALUES (?, ?, ?, ?, 'Duplicated', now())""", UUID.randomUUID(), applicationId, offerId, first))
                .isInstanceOf(DataIntegrityViolationException.class);
        // CHECK num_nonnulls ≤ 1 : deux porteurs pour une même réponse.
        assertThatThrownBy(() -> jdbcTemplate.update("""
                INSERT INTO application_answer (id, application_id, job_offer_id, question_id, answer_text,
                                                answer_boolean, created_at)
                VALUES (?, ?, ?, ?, 'Text', true, now())""", UUID.randomUUID(), applicationId, offerId, second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sansQuestionsLeCvCourantEstRenseigneEtEpingle() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "No Questions", null);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID cvId = uploadCv(candidateJwt);

        // `answers` absentes ≡ vides ; le CV courant est renseigné dès le brouillon puis épinglé.
        MvcResult drafted = mockMvc.perform(put(APPLICATIONS_PATH + "/draft")
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicIdOf(offerId) + "\", \"answers\": null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(0))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()))
                .andReturn();
        submit(candidateJwt, idOf(drafted), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()));

        // Contexte d'un compte sans ligne candidates : CV courant null, 200.
        String otherJwt = signup();
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicIdOf(offerId))
                        .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentCvAttachmentId").doesNotExist())
                .andExpect(jsonPath("$.existingApplication").doesNotExist())
                // Offre sans question : étape matching dès l'ouverture, avant tout brouillon.
                .andExpect(jsonPath("$.step").value("matching"))
                .andExpect(jsonPath("$.canSubmit").value(true));
    }

    @Test
    void suppressionDuCvDetacheLesBrouillonsMaisRefuseUnCvJointAUneCandidatureTransmise() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Cv Delete", null);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID firstCv = uploadCv(candidateJwt);
        UUID draftId = idOf(saveDraft(candidateJwt, publicIdOf(offerId), "[]").andExpect(status().isOk()).andReturn());
        assertThat(jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?", UUID.class,
                draftId)).isEqualTo(firstCv);
        UUID secondCv = uploadCv(candidateJwt);

        // TD-054 : le CV d'un brouillon n'est pas figé — détaché puis supprimé (204, jamais un 500 de FK).
        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + firstCv).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?", UUID.class,
                draftId)).isNull();
        assertThat(count("SELECT count(*) FROM attachment WHERE id = ?", firstCv)).isZero();

        // La transmission reprend le CV courant, qui devient figé.
        submit(candidateJwt, draftId, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cv.attachmentId").value(secondCv.toString()));
        mockMvc.perform(delete(ATTACHMENTS_PATH + "/" + secondCv).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail")
                        .value("This CV is attached to an application you sent and cannot be deleted."));
        assertThat(count("SELECT count(*) FROM attachment WHERE id = ?", secondCv)).isOne();
        assertThat(jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?", UUID.class,
                draftId)).isEqualTo(secondCv);
    }

    @Test
    void entreesFacultativesDuBrouillonEtDeLaTransmission() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Optional Inputs", null);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        UUID cvId = uploadCv(candidateJwt);
        String publicId = publicIdOf(offerId);

        // jobPublicId absent ou vide : 400 de validation, jamais un 500.
        for (String body : List.of("{\"answers\": []}", "{\"jobPublicId\": \"\", \"answers\": []}")) {
            mockMvc.perform(put(APPLICATIONS_PATH + "/draft").header("Authorization", "Bearer " + candidateJwt)
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        // Une réponse null dans la liste : 400.
        saveDraft(candidateJwt, publicId, "[null]").andExpect(status().isBadRequest());
        // answers absent du JSON ≡ vide.
        UUID draftId = idOf(mockMvc.perform(put(APPLICATIONS_PATH + "/draft")
                        .header("Authorization", "Bearer " + candidateJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + publicId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(0))
                .andReturn());

        // Identifiants illisibles : 400 générique (handleUnreadableClientInput), aucune écriture.
        mockMvc.perform(post(APPLICATIONS_PATH + "/not-a-uuid/submit").header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));
        submit(candidateJwt, draftId, "{\"cvAttachmentId\": \"abc\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));
        assertThat(statusOf(draftId)).isEqualTo(1);

        // {"cvAttachmentId": null} ≡ {} ≡ corps absent : le CV du brouillon est épinglé.
        submit(candidateJwt, draftId, "{\"cvAttachmentId\": null}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("submitted"))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()));

        UUID secondOffer = createOffer(owner.token(), owner.companyId(), "Optional Inputs Bis", null);
        publish(owner.token(), secondOffer);
        UUID secondDraft = idOf(saveDraft(candidateJwt, publicIdOf(secondOffer), "[]").andReturn());
        submit(candidateJwt, secondDraft, "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()));
    }

    @Test
    void unCompteSansProfilCandidatNePeutPasOuvrirDeBrouillon() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "No Profile", null);
        publish(owner.token(), offerId);
        String freshJwt = signup();

        // Compte inscrit mais jamais passé par son profil : refus métier explicite, plus de 500 de FK.
        saveDraft(freshJwt, publicIdOf(offerId), "[]")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Complete your candidate profile before applying."));
        assertThat(count("SELECT count(*) FROM application WHERE job_offer_id = ?", offerId)).isZero();
    }

    @Test
    void deuxPremiersEnregistrementsSimultanesNeCreentQuUnSeulBrouillon() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Concurrent Draft", null);
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        uploadCv(candidateJwt);
        String publicId = publicIdOf(offerId);

        // TD-053 : double clic / deux onglets — le verrou candidat sérialise, aucun 500 d'unicité.
        List<Integer> statuses = twoAtOnce(
                () -> saveDraft(candidateJwt, publicId, "[]").andReturn().getResponse().getStatus());

        assertThat(statuses).containsExactly(200, 200);
        assertThat(count("SELECT count(*) FROM application WHERE job_offer_id = ?", offerId)).isOne();
    }

    @Test
    void validationsDuBrouillonEtDeLaTransmission() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        String candidateJwt = signup();
        UUID candidateId = lastUserId();
        uploadCv(candidateJwt);
        UUID textQuestion = questionIdOf(offerId, "Why this role?");
        String complete = """
                [
                  {"questionId": "%s", "text": "Why not"},
                  {"questionId": "%s", "optionIds": ["%s"]}
                ]""".formatted(textQuestion, questionIdOf(offerId, "Preferred setup?"), optionIdOf(offerId, "Remote"));

        // Sans CV du tout : 409 même avec des réponses valides. Le compte est déjà
        // candidat (profil écrit) — postuler suppose un compte candidat existant.
        String noCvJwt = signup();
        mockMvc.perform(put("/api/v1/candidates/me/profile/about")
                        .header("Authorization", "Bearer " + noCvJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Backend Engineer\", \"yearsOfExperience\": 3,"
                                + " \"searchStatus\": \"open_to_work\"}"))
                .andExpect(status().isNoContent());
        UUID noCvDraft = idOf(saveDraft(noCvJwt, publicId, complete).andExpect(status().isOk()).andReturn());
        submit(noCvJwt, noCvDraft, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("A CV is required to apply. Add one to your profile first."));

        // Question inconnue de l'offre.
        saveDraft(candidateJwt, publicId, "[{\"questionId\": \"%s\", \"text\": \"x\"}]".formatted(UUID.randomUUID()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Unknown question in your submission."));
        // Nombre à plus de 2 décimales refusé (NUMERIC(12,2) altérerait la réponse).
        saveDraft(candidateJwt, publicId, "[{\"questionId\": \"%s\", \"number\": 1.999}]"
                .formatted(questionIdOf(offerId, "Years of experience?")))
                .andExpect(status().isBadRequest());
        // Aucun brouillon n'a été écrit par ces refus.
        assertThat(count("SELECT count(*) FROM application WHERE candidate_id = ?", candidateId)).isZero();

        // CV d'un autre candidat refusé à la transmission (400).
        UUID draftId = idOf(saveDraft(candidateJwt, publicId, complete).andExpect(status().isOk()).andReturn());
        String otherJwt = signup();
        UUID otherCvId = uploadCv(otherJwt);
        submit(candidateJwt, draftId, "{\"cvAttachmentId\": \"" + otherCvId + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("The selected CV is not available."));
        assertThat(statusOf(draftId)).isEqualTo(1);
    }

    @Test
    void abandonDuBrouillonEtCandidatureDAutrui() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", """
                [{"label": "Why?", "type": "text", "isRequired": true, "sortOrder": 0}]""");
        publish(owner.token(), offerId);
        String candidateJwt = signup();
        uploadCv(candidateJwt);
        UUID question = questionIdOf(offerId, "Why?");

        UUID draftId = idOf(saveDraft(candidateJwt, publicIdOf(offerId),
                "[{\"questionId\": \"%s\", \"text\": \"Because\"}]".formatted(question))
                .andExpect(status().isOk()).andReturn());

        // La candidature d'un autre candidat est introuvable (404, zéro fuite).
        String otherJwt = signup();
        mockMvc.perform(delete(APPLICATIONS_PATH + "/" + draftId).header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
        submit(otherJwt, draftId, null).andExpect(status().isNotFound());
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + draftId + "/withdraw").header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(APPLICATIONS_PATH + "/mine").header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Un brouillon se retire pas : il s'abandonne.
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + draftId + "/withdraw").header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isConflict());
        mockMvc.perform(delete(APPLICATIONS_PATH + "/" + draftId).header("Authorization", "Bearer " + candidateJwt))
                .andExpect(status().isNoContent());
        assertThat(count("SELECT count(*) FROM application WHERE id = ?", draftId)).isZero();
        assertThat(count("SELECT count(*) FROM application_answer WHERE application_id = ?", draftId)).isZero();

        // Le couple est libre à nouveau : un nouveau brouillon peut naître.
        saveDraft(candidateJwt, publicIdOf(offerId), "[]").andExpect(status().isOk());
    }

    @Test
    void offresIndisponibles() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID draftId = createOffer(owner.token(), owner.companyId(), "Draft Offer", null);
        UUID expiredId = createOffer(owner.token(), owner.companyId(), "Expired Offer", null);
        publish(owner.token(), expiredId);
        jdbcTemplate.update("UPDATE job_offer SET expires_at = CURRENT_DATE - 1 WHERE id = ?", expiredId);
        UUID closedId = createOffer(owner.token(), owner.companyId(), "Closed Offer", null);
        publish(owner.token(), closedId);

        String candidateJwt = signup();
        uploadCv(candidateJwt);
        // Brouillon pris tant que l'offre est ouverte, puis l'offre ferme : transmission en 404.
        UUID pendingDraft = idOf(saveDraft(candidateJwt, publicIdOf(closedId), "[]")
                .andExpect(status().isOk()).andReturn());
        mockMvc.perform(post("/api/v1/job-offers/" + closedId + "/close")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNoContent());
        submit(candidateJwt, pendingDraft, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("This job offer is no longer available."));

        for (UUID offerId : List.of(draftId, expiredId, closedId)) {
            saveDraft(candidateJwt, publicIdOf(offerId), "[]")
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.detail").value("This job offer is no longer available."));
            mockMvc.perform(get(APPLICATIONS_PATH + "/context/" + publicIdOf(offerId))
                            .header("Authorization", "Bearer " + candidateJwt))
                    .andExpect(status().isNotFound());
        }
        saveDraft(candidateJwt, "zzzzzzzzzzzz", "[]").andExpect(status().isNotFound());
    }

    @Test
    void sansJetonToutEst401() throws Exception {
        mockMvc.perform(put(APPLICATIONS_PATH + "/draft")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"abc123def456\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + UUID.randomUUID() + "/submit"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete(APPLICATIONS_PATH + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(APPLICATIONS_PATH + "/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get(APPLICATIONS_PATH + "/context/abc123def456")).andExpect(status().isUnauthorized());
        mockMvc.perform(post(APPLICATIONS_PATH + "/" + UUID.randomUUID() + "/withdraw"))
                .andExpect(status().isUnauthorized());
    }

    private void assertAlreadyApplied(String token, String publicId) throws Exception {
        saveDraft(token, publicId, "[]")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You have already applied to this job offer."));
    }

    private ResultActions saveDraft(String token, String publicId, String answersJson) throws Exception {
        return mockMvc.perform(put(APPLICATIONS_PATH + "/draft")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"jobPublicId\": \"" + publicId + "\", \"answers\": " + answersJson + "}"));
    }

    private ResultActions submit(String token, UUID applicationId, String bodyJson) throws Exception {
        MockHttpServletRequestBuilder request = post(APPLICATIONS_PATH + "/" + applicationId + "/submit")
                .header("Authorization", "Bearer " + token);
        if (bodyJson != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(bodyJson);
        }
        return mockMvc.perform(request);
    }

    /** Parcours complet : brouillon puis transmission ; renvoie l'id de la candidature. */
    private UUID apply(String token, String publicId, String answersJson) throws Exception {
        UUID applicationId = idOf(saveDraft(token, publicId, answersJson).andExpect(status().isOk()).andReturn());
        submit(token, applicationId, null).andExpect(status().isOk());
        return applicationId;
    }

    /** Lance deux appels au même instant (TD-053) et renvoie leurs statuts HTTP. */
    private List<Integer> twoAtOnce(Callable<Integer> call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                calls.add(pool.submit(() -> {
                    go.await();
                    return call.call();
                }));
            }
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : calls) {
                statuses.add(future.get(30, TimeUnit.SECONDS));
            }
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }

    private UUID idOf(MvcResult result) throws Exception {
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private Integer statusOf(UUID applicationId) {
        return jdbcTemplate.queryForObject("SELECT status FROM application WHERE id = ?", Integer.class, applicationId);
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
