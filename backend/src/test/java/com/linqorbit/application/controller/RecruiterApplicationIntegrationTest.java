package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.service.NormalizationWorker;

/**
 * Vue recruteur T-66 (D65) sur PostgreSQL réel : migration V24 et backfill,
 * tri SQL des sections JSONB et des contestations, filtres/statuts, droits
 * D12, détail, CV épinglé, décisions terminales et concurrence.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecruiterApplicationIntegrationTest extends ApplicationStorageTestSupport {

    private static final String OFFERS_PATH = "/api/v1/job-offers";
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
               ]}
            ]""";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private DataSource dataSource;

    @MockitoBean
    private NormalizationWorker normalizationWorker;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();
    private final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            // L'application porte la FK vers le matching : elle part d'abord.
            jdbcTemplate.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_criterion_feedback f
                    USING matching m
                    WHERE f.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM clarification c
                    USING matching m
                    WHERE c.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("DELETE FROM matching_result r USING matching m"
                    + " WHERE r.matching_id = m.id AND m.job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM matching WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM normalization_job WHERE job_id IN"
                    + " (SELECT normalized_profile_id FROM normalized_profile_job_offer"
                    + " WHERE job_offer_id = ?)", offerId);
            jdbcTemplate.update("DELETE FROM normalized_profile_job_offer WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_skill WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_language WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_degree WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_study_field WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer_question WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("DELETE FROM job_offer WHERE id = ?", offerId);
        }
        for (UUID candidateId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM application WHERE candidate_id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM matching_criterion_feedback WHERE matching_id IN"
                    + " (SELECT id FROM matching WHERE candidate_id = ?)", candidateId);
            jdbcTemplate.update("DELETE FROM clarification WHERE matching_id IN"
                    + " (SELECT id FROM matching WHERE candidate_id = ?)", candidateId);
            jdbcTemplate.update("DELETE FROM matching_result WHERE matching_id IN"
                    + " (SELECT id FROM matching WHERE candidate_id = ?)", candidateId);
            jdbcTemplate.update("DELETE FROM matching WHERE candidate_id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM normalization_job WHERE job_id IN"
                    + " (SELECT normalized_profile_id FROM normalized_profile_candidate"
                    + " WHERE candidate_id = ?)", candidateId);
            jdbcTemplate.update("DELETE FROM normalized_profile_candidate WHERE candidate_id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", candidateId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", candidateId);
        }
        jdbcTemplate.update("""
                DELETE FROM normalization_job j
                WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                   WHERE npc.normalized_profile_id = j.job_id)
                  AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                   WHERE npo.normalized_profile_id = j.job_id)
                  AND NOT EXISTS (SELECT 1 FROM matching m
                                   WHERE m.candidate_normalized_profile_id = j.job_id)
                  AND NOT EXISTS (SELECT 1 FROM matching_result r
                                   WHERE r.job_offer_normalized_profile_id = j.job_id)""");
        jdbcTemplate.update("""
                DELETE FROM normalized_profile np
                WHERE NOT EXISTS (SELECT 1 FROM normalized_profile_candidate npc
                                   WHERE npc.normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM normalized_profile_job_offer npo
                                   WHERE npo.normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM matching m
                                   WHERE m.candidate_normalized_profile_id = np.normalized_profile_id)
                  AND NOT EXISTS (SELECT 1 FROM matching_result r
                                   WHERE r.job_offer_normalized_profile_id = np.normalized_profile_id)""");
        for (UUID companyId : createdCompanyIds) {
            jdbcTemplate.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        createdOfferIds.clear();
        createdUserIds.clear();
        createdCompanyIds.clear();
    }

    @Test
    void offerListCountsOnlyVisibleApplications() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account grace = signup("Grace", "Hopper");
        Account alan = signup("Alan", "Turing");
        Account edsger = signup("Edsger", "Dijkstra");
        Account barbara = signup("Barbara", "Liskov");

        // Deux candidatures transmises : elles comptent.
        submitDirect(grace, uploadCv(grace.token()), publicId);
        submitDirect(alan, uploadCv(alan.token()), publicId);
        // Un brouillon ne compte pas.
        uploadCv(edsger.token());
        saveDraft(edsger.token(), publicId, "[]").andExpect(status().isOk());
        // Un retrait ne compte pas.
        UUID withdrawn = submitDirect(barbara, uploadCv(barbara.token()), publicId);
        mockMvc.perform(post("/api/v1/applications/" + withdrawn + "/withdraw")
                        .header("Authorization", "Bearer " + barbara.token()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(OFFERS_PATH).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '" + offerId + "')].applicationCount",
                        hasItem(2)));
    }

    @Test
    void migrationV24BackfillsAndGuardsSubmittedAt() throws Exception {
        String schema = "v24_" + UUID.randomUUID().toString().replace("-", "");
        try {
            jdbcTemplate.execute("CREATE SCHEMA " + schema);
            jdbcTemplate.execute("CREATE TABLE " + schema + ".application ("
                    + "id UUID PRIMARY KEY, job_offer_id UUID NOT NULL, status SMALLINT NOT NULL,"
                    + " created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL)");
            UUID draftId = UUID.randomUUID();
            UUID submittedId = UUID.randomUUID();
            UUID acceptedId = UUID.randomUUID();
            UUID rejectedId = UUID.randomUUID();
            UUID offerId = UUID.randomUUID();
            insertLegacy(schema, draftId, offerId, 1, "2026-10-01 10:00:00");
            insertLegacy(schema, submittedId, offerId, 2, "2026-10-02 10:00:00");
            insertLegacy(schema, acceptedId, offerId, 4, "2026-10-03 10:00:00");
            insertLegacy(schema, rejectedId, offerId, 5, "2026-10-04 10:00:00");

            String migration = new String(new ClassPathResource(
                    "db/migration/V24__add_application_submitted_at.sql")
                    .getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            try (Connection connection = dataSource.getConnection();
                    Statement statement = connection.createStatement()) {
                try {
                    statement.execute("SET search_path TO " + schema);
                    statement.execute(migration);
                } finally {
                    statement.execute("SET search_path TO public");
                }
            }

            assertThat(jdbcTemplate.queryForObject("SELECT submitted_at IS NULL FROM " + schema
                    + ".application WHERE id = ?", Boolean.class, draftId)).isTrue();
            for (UUID id : List.of(submittedId, acceptedId, rejectedId)) {
                assertThat(jdbcTemplate.queryForObject("SELECT submitted_at = created_at FROM " + schema
                        + ".application WHERE id = ?", Boolean.class, id)).isTrue();
            }

            // CHECK : un non-brouillon sans date et un brouillon daté sont refusés.
            assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + schema
                    + ".application SET status = 2 WHERE id = ?", draftId))
                    .isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + schema
                    + ".application SET submitted_at = now() WHERE id = ?", draftId))
                    .isInstanceOf(DataIntegrityViolationException.class);

            // Trigger : la première écriture passe (dans la même transition), toute autre est refusée.
            jdbcTemplate.update("UPDATE " + schema
                    + ".application SET status = 2, submitted_at = created_at WHERE id = ?", draftId);
            assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + schema
                    + ".application SET submitted_at = submitted_at + interval '1 second' WHERE id = ?",
                    draftId)).isInstanceOf(DataIntegrityViolationException.class);
            assertThatThrownBy(() -> jdbcTemplate.update("UPDATE " + schema
                    + ".application SET submitted_at = NULL WHERE id = ?", submittedId))
                    .isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }

    @Test
    void listSortsJsonbSectionsAndContestsWithFiltersAndD12Rights() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        String listPath = OFFERS_PATH + "/" + offerId + "/applications";

        Account grace = signup("Grace", "Hopper");
        Account alan = signup("Alan", "Turing");
        Account edsger = signup("Edsger", "Dijkstra");
        Account barbara = signup("Barbara", "Liskov");
        UUID graceCv = uploadCv(grace.token());
        UUID alanCv = uploadCv(alan.token());
        UUID edsgerCv = uploadCv(edsger.token());
        UUID barbaraCv = uploadCv(barbara.token());

        UUID graceApp = draftAndMatch(grace, graceCv, publicId, resultJson(60, 70, 80, 90, 95),
                List.of(feedback("skill:java", 90, "I built several JVMs"),
                        feedback("language:english", 70, "I write English docs")), "Why did you choose Java?");
        jdbcTemplate.update("UPDATE candidates SET title = ? WHERE id = ?",
                "Senior Backend Engineer", grace.userId());
        UUID alanApp = draftAndMatch(alan, alanCv, publicId, resultJson(80, 75, 70, 65, 60),
                List.of(feedback("skill:java", 85, null)), "How do you test?");
        jdbcTemplate.update("UPDATE candidates SET title = ? WHERE id = ?", "   ", alan.userId());
        UUID edsgerApp = submitDirect(edsger, edsgerCv, publicId);
        UUID barbaraApp = draftAndMatch(barbara, barbaraCv, publicId, resultJson(90, 75, 70, 65, 60),
                List.of(feedback("skill:java", 70, "The AI underestimated my Java depth")), null);

        // Défaut SUBMITTED, date de transmission croissante. Scores JSONB et
        // agrégats de feedback sont calculés en SQL avant pagination.
        mockMvc.perform(get(listPath).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job.id").value(offerId.toString()))
                .andExpect(jsonPath("$.job.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.job.status").value("published"))
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.items[*].id",
                        contains(graceApp.toString(), alanApp.toString(), edsgerApp.toString(),
                                barbaraApp.toString())))
                .andExpect(jsonPath("$.items[0].candidate.firstName").value("Grace"))
                .andExpect(jsonPath("$.items[0].candidate.title").value("Senior Backend Engineer"))
                .andExpect(jsonPath("$.items[1].candidate.title").value(nullValue()))
                .andExpect(jsonPath("$.items[0].assessmentAvailable").value(true))
                .andExpect(jsonPath("$.items[0].sections.length()").value(5))
                .andExpect(jsonPath("$.items[0].sections[0].section").value("requiredSkills"))
                .andExpect(jsonPath("$.items[0].sections[0].score").value(60.0))
                .andExpect(jsonPath("$.items[0].contestedCount").value(2))
                .andExpect(jsonPath("$.items[0].averageGap").value(20.0))
                .andExpect(jsonPath("$.items[1].contestedCount").value(1))
                .andExpect(jsonPath("$.items[1].averageGap").value(5.0))
                .andExpect(jsonPath("$.items[2].assessmentAvailable").value(false))
                .andExpect(jsonPath("$.items[2].sections[0].score").value(nullValue()))
                .andExpect(jsonPath("$.items[2].contestedCount").value(0))
                .andExpect(jsonPath("$.items[2].averageGap").value(nullValue()))
                .andExpect(jsonPath("$.items[3].contestedCount").value(1))
                .andExpect(jsonPath("$.items[3].averageGap").value(20.0));

        // Tri par section asc/desc, nulls last : l'application directe reste en dernier.
        // Les cinq CASE JSONB du SQL natif sont exercés (et les égalités retombent
        // sur la date de transmission puis l'id).
        String[] sectionSorts = {"requiredSkills", "preferredSkills", "languages", "experience", "education"};
        String[][] ascending = {
            ids(graceApp, alanApp, barbaraApp, edsgerApp),
            ids(graceApp, alanApp, barbaraApp, edsgerApp),
            ids(alanApp, barbaraApp, graceApp, edsgerApp),
            ids(alanApp, barbaraApp, graceApp, edsgerApp),
            ids(alanApp, barbaraApp, graceApp, edsgerApp)
        };
        String[][] descending = {
            ids(barbaraApp, alanApp, graceApp, edsgerApp),
            ids(alanApp, barbaraApp, graceApp, edsgerApp),
            ids(graceApp, alanApp, barbaraApp, edsgerApp),
            ids(graceApp, alanApp, barbaraApp, edsgerApp),
            ids(graceApp, alanApp, barbaraApp, edsgerApp)
        };
        for (int index = 0; index < sectionSorts.length; index++) {
            mockMvc.perform(get(listPath).param("sort", sectionSorts[index]).param("direction", "asc")
                            .header("Authorization", "Bearer " + owner.token()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].id", contains(ascending[index])));
            mockMvc.perform(get(listPath).param("sort", sectionSorts[index]).param("direction", "desc")
                            .header("Authorization", "Bearer " + owner.token()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].id", contains(descending[index])));
        }

        // Contestations : nombre desc, puis écart moyen desc, puis date asc.
        mockMvc.perform(get(listPath).param("sort", "contests")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id",
                        contains(graceApp.toString(), barbaraApp.toString(), alanApp.toString(),
                                edsgerApp.toString())));

        // Pagination décidée par le serveur : page/size effectifs dans l'enveloppe.
        mockMvc.perform(get(listPath).param("page", "1").param("size", "1")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(alanApp.toString()));
        mockMvc.perform(get(listPath).param("page", "-2").param("size", "999")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50));

        // Décision owner : B accepté, puis filtre accepted et total.
        decide(owner.token(), offerId, alanApp, "accepted").andExpect(status().isNoContent());
        mockMvc.perform(get(listPath).param("status", "accepted")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(alanApp.toString()))
                .andExpect(jsonPath("$.items[0].status").value("accepted"));
        mockMvc.perform(get(listPath).param("status", "SUBMITTED")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[*].id",
                        contains(graceApp.toString(), edsgerApp.toString(), barbaraApp.toString())));

        // Une décision hors accepted/rejected est refusée avant toute écriture.
        decide(owner.token(), offerId, graceApp, "maybe").andExpect(status().isBadRequest());

        // Brouillons et retraits invalides comme filtre ; un retrait disparaît de la liste et du détail.
        for (String invalid : List.of("draft", "withdrawn", "unknown")) {
            mockMvc.perform(get(listPath).param("status", invalid)
                            .header("Authorization", "Bearer " + owner.token()))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(get(listPath).param("sort", "bogus")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(listPath).param("direction", "sideways")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isBadRequest());

        // Application directe sans matching : détail lisible, aucune évaluation inventée.
        mockMvc.perform(get(listPath + "/" + edsgerApp)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assessment.available").value(false))
                .andExpect(jsonPath("$.assessment.sections.length()").value(0))
                .andExpect(jsonPath("$.answers.length()").value(0))
                .andExpect(jsonPath("$.clarifications.length()").value(0))
                .andExpect(jsonPath("$.contests.length()").value(0))
                .andExpect(jsonPath("$.averageGap").value(nullValue()))
                .andExpect(jsonPath("$.cv.originalName").value("candidate-cv.pdf"))
                .andExpect(jsonPath("$.canDecide").value(true));

        mockMvc.perform(post("/api/v1/applications/" + edsgerApp + "/withdraw")
                        .header("Authorization", "Bearer " + edsger.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(listPath).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[*].id",
                        contains(graceApp.toString(), barbaraApp.toString())));
        mockMvc.perform(get(listPath + "/" + edsgerApp).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(listPath + "/" + edsgerApp + "/cv")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNotFound());

        // Membre : lecture oui, décision non (403). Non-membre / candidat : 404. Sans jeton : 401.
        Account member = memberOf(owner.companyId());
        mockMvc.perform(get(listPath).header("Authorization", "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
        decide(member.token(), offerId, graceApp, "rejected").andExpect(status().isForbidden());
        Account outsider = signupRecruiter("Out", "Sider");
        mockMvc.perform(get(listPath).header("Authorization", "Bearer " + outsider.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(listPath).header("Authorization", "Bearer " + grace.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(listPath)).andExpect(status().isUnauthorized());
    }

    @Test
    void detailExposesAnswersAssessmentClarificationsContestsCvAndTerminalDecision() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", QUESTIONS_ALL_TYPES);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        String detailPath = OFFERS_PATH + "/" + offerId + "/applications";

        Account candidate = signup("Grace", "Hopper");
        UUID cvId = uploadCv(candidate.token());
        UUID textQuestion = questionIdOf(offerId, "Why this role?");
        UUID singleQuestion = questionIdOf(offerId, "Preferred setup?");
        UUID multipleQuestion = questionIdOf(offerId, "Your stacks?");
        UUID onSite = optionIdOf(offerId, "On site");
        UUID java = optionIdOf(offerId, "Java");
        UUID python = optionIdOf(offerId, "Python");
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, """
                [
                  {"questionId": "%s", "text": "I love the product"},
                  {"questionId": "%s", "optionIds": ["%s"]},
                  {"questionId": "%s", "optionIds": ["%s", "%s"]}
                ]""".formatted(textQuestion, singleQuestion, onSite, multipleQuestion, python, java))
                .andExpect(status().isOk()).andReturn());
        UUID matchingId = createMatching(candidate.userId(), offerId, resultJson(60, 70, 80, 90, 95),
                List.of(feedback("skill:java", 90, "I built several JVMs"),
                        feedback("language:english", 70, "I write English docs")), "Why did you choose Java?");
        submit(candidate.token(), applicationId, null).andExpect(status().isOk());
        jdbcTemplate.update("UPDATE candidates SET title = ? WHERE id = ?",
                "Senior Backend Engineer", candidate.userId());

        MvcResult detail = mockMvc.perform(get(detailPath + "/" + applicationId)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId.toString()))
                .andExpect(jsonPath("$.candidate.firstName").value("Grace"))
                .andExpect(jsonPath("$.candidate.lastName").value("Hopper"))
                .andExpect(jsonPath("$.candidate.title").value("Senior Backend Engineer"))
                .andExpect(jsonPath("$.status").value("submitted"))
                .andExpect(jsonPath("$.submittedAt").isNotEmpty())
                .andExpect(jsonPath("$.canDecide").value(true))
                .andExpect(jsonPath("$.job.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.answers.length()").value(3))
                .andExpect(jsonPath("$.answers[0].label").value("Why this role?"))
                .andExpect(jsonPath("$.answers[0].text").value("I love the product"))
                .andExpect(jsonPath("$.answers[1].options[0].label").value("On site"))
                .andExpect(jsonPath("$.answers[1].options[0].preferred").value(true))
                .andExpect(jsonPath("$.answers[2].options.length()").value(2))
                .andExpect(jsonPath("$.assessment.available").value(true))
                .andExpect(jsonPath("$.assessment.sections.length()").value(5))
                .andExpect(jsonPath("$.assessment.sections[0].section").value("requiredSkills"))
                .andExpect(jsonPath("$.assessment.sections[0].score").value(60.0))
                .andExpect(jsonPath("$.assessment.sections[0].criteria[0].rationale")
                        .value("Criterion rationale"))
                .andExpect(jsonPath("$.clarifications.length()").value(1))
                .andExpect(jsonPath("$.clarifications[0].question").value("Why did you choose Java?"))
                .andExpect(jsonPath("$.clarifications[0].answer").value("Because I use it daily."))
                .andExpect(jsonPath("$.clarifications[0].status").value("answered"))
                .andExpect(jsonPath("$.contests.length()").value(2))
                .andExpect(jsonPath("$.contests[0].criterionKey").value("language:english"))
                .andExpect(jsonPath("$.contests[0].aiScore").value(80))
                .andExpect(jsonPath("$.contests[0].selfValue").value(70))
                .andExpect(jsonPath("$.contests[0].gap").value(10.0))
                .andExpect(jsonPath("$.contests[1].criterionKey").value("skill:java"))
                .andExpect(jsonPath("$.contests[1].gap").value(30.0))
                // Écart moyen calculé par le serveur, identique à celui de la carte de liste.
                .andExpect(jsonPath("$.averageGap").value(20.0))
                .andExpect(jsonPath("$.cv.attachmentId").value(cvId.toString()))
                .andExpect(jsonPath("$.cv.originalName").value("candidate-cv.pdf"))
                .andReturn();

        assertThat(jdbcTemplate.queryForObject("SELECT matching_id FROM application WHERE id = ?",
                UUID.class, applicationId)).isEqualTo(matchingId);
        assertThat(jdbcTemplate.queryForObject("SELECT submitted_at IS NOT NULL FROM application WHERE id = ?",
                Boolean.class, applicationId)).isTrue();
        assertThat(objectMapper.readTree(detail.getResponse().getContentAsString())
                .get("submittedAt").asText()).isNotBlank();

        // Membre : lecture complète (détail + CV), mais canDecide=false et décision 403.
        Account member = memberOf(owner.companyId());
        mockMvc.perform(get(detailPath + "/" + applicationId).header("Authorization", "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canDecide").value(false));
        mockMvc.perform(get(detailPath + "/" + applicationId + "/cv")
                        .header("Authorization", "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"));
        decide(member.token(), offerId, applicationId, "accepted").andExpect(status().isForbidden());

        // CV : flux réservé aux membres de la company.
        mockMvc.perform(get(detailPath + "/" + applicationId + "/cv")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("candidate-cv.pdf")))
                .andExpect(content().bytes("%PDF-1.4 candidate".getBytes(StandardCharsets.UTF_8)));
        mockMvc.perform(get(detailPath + "/" + applicationId + "/cv")
                        .header("Authorization", "Bearer " + candidate.token()))
                .andExpect(status().isNotFound());

        // Décision manuelle terminale : accepted puis 409, aucun recalcul.
        decide(owner.token(), offerId, applicationId, "accepted").andExpect(status().isNoContent());
        decide(owner.token(), offerId, applicationId, "rejected").andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This application has already been decided."));
        mockMvc.perform(get(detailPath + "/" + applicationId).header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("accepted"))
                .andExpect(jsonPath("$.canDecide").value(false));
        assertThat(statusOf(applicationId)).isEqualTo(4);
        assertThat(jdbcTemplate.queryForObject("SELECT submitted_at FROM application WHERE id = ?",
                java.sql.Timestamp.class, applicationId)).isNotNull();
    }

    @Test
    void offerCreatorCanDecideWithoutBeingCompanyOwner() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        Account creator = memberOf(owner.companyId());
        UUID offerId = createOffer(creator.token(), owner.companyId(), "Backend Engineer", null);
        publish(creator.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Ada", "Lovelace");
        UUID cvId = uploadCv(candidate.token());
        UUID applicationId = submitDirect(candidate, cvId, publicId);
        String detailPath = OFFERS_PATH + "/" + offerId + "/applications/" + applicationId;

        mockMvc.perform(get(detailPath).header("Authorization", "Bearer " + creator.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canDecide").value(true));
        decide(creator.token(), offerId, applicationId, "accepted").andExpect(status().isNoContent());
        assertThat(statusOf(applicationId)).isEqualTo(4);
    }

    @Test
    void submitIsLockedAndSubmittedAtCannotBeChanged() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID cvId = uploadCv(candidate.token());
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());

        List<Integer> statuses = twoAtOnce(() -> submit(candidate.token(), applicationId, null)
                .andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(statusOf(applicationId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT cv_attachment_id FROM application WHERE id = ?",
                UUID.class, applicationId)).isEqualTo(cvId);
        assertThat(jdbcTemplate.queryForObject("SELECT submitted_at IS NOT NULL FROM application WHERE id = ?",
                Boolean.class, applicationId)).isTrue();

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE application SET submitted_at = submitted_at + interval '1 second' WHERE id = ?",
                applicationId)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE application SET submitted_at = NULL WHERE id = ?", applicationId))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void concurrentDecisionsAreSerializedToTerminalStatus() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);
        Account candidate = signup("Grace", "Hopper");
        UUID cvId = uploadCv(candidate.token());
        UUID applicationId = submitDirect(candidate, cvId, publicId);

        List<Integer> statuses = twoAtOnce(() -> decide(owner.token(), offerId, applicationId, "accepted")
                .andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(204, 409);
        assertThat(statusOf(applicationId)).isEqualTo(4);
    }

    private void insertLegacy(String schema, UUID id, UUID offerId, int status, String createdAt) {
        jdbcTemplate.update("INSERT INTO " + schema + ".application"
                + " (id, job_offer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?::timestamp, ?::timestamp)",
                id, offerId, status, createdAt, createdAt);
    }

    private record Owner(String token, UUID companyId) {
    }

    private record Account(String token, UUID userId) {
    }

    private Owner ownerWithCompany(String companyName) throws Exception {
        Account owner = signupRecruiter("Ada", "Owner");
        MvcResult result = mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + companyName + "\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        UUID companyId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdCompanyIds.add(companyId);
        return new Owner(owner.token(), companyId);
    }

    private Account memberOf(UUID companyId) throws Exception {
        Account member = signupRecruiter("Mia", "Member");
        jdbcTemplate.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, false)",
                companyId, member.userId());
        return member;
    }

    private Account signupRecruiter(String firstName, String lastName) throws Exception {
        Account account = signup(firstName, lastName);
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + account.token()))
                .andExpect(status().isCreated());
        return account;
    }

    private Account signup(String firstName, String lastName) throws Exception {
        String email = "recruiter-view-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "%s",
                                  "lastName": "%s",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email, firstName, lastName)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID userId = UUID.fromString(body.get("user").get("id").asText());
        createdUserIds.add(userId);
        return new Account(body.get("token").asText(), userId);
    }

    private UUID createOffer(String token, UUID companyId, String title, String questionsArrayJson)
            throws Exception {
        String questions = questionsArrayJson == null || questionsArrayJson.isBlank()
                ? ""
                : ",\n  \"questions\": " + questionsArrayJson;
        MvcResult result = mockMvc.perform(post(OFFERS_PATH)
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
                                """.formatted(companyId, title, CONTRACT_TYPE_ID, EMPLOYMENT_TYPE_ID,
                                WORK_MODE_ID, SKILL_ID, questions)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID offerId = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
        createdOfferIds.add(offerId);
        return offerId;
    }

    private void publish(String token, UUID offerId) throws Exception {
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private UUID draftAndMatch(Account candidate, UUID cvId, String publicId, String resultJson,
            List<FeedbackSpec> feedback, String clarification) throws Exception {
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());
        createMatching(candidate.userId(), offerIdOf(publicId), resultJson, feedback, clarification);
        submit(candidate.token(), applicationId, null).andExpect(status().isOk());
        return applicationId;
    }

    private UUID submitDirect(Account candidate, UUID cvId, String publicId) throws Exception {
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());
        submit(candidate.token(), applicationId, null).andExpect(status().isOk());
        return applicationId;
    }

    private ResultActions saveDraft(String token, String publicId, String answersJson) throws Exception {
        return mockMvc.perform(put("/api/v1/applications/draft")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"jobPublicId\": \"" + publicId + "\", \"answers\": " + answersJson + "}"));
    }

    private ResultActions submit(String token, UUID applicationId, String bodyJson) throws Exception {
        var request = post("/api/v1/applications/" + applicationId + "/submit")
                .header("Authorization", "Bearer " + token);
        if (bodyJson != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(bodyJson);
        }
        return mockMvc.perform(request);
    }

    private ResultActions decide(String token, UUID offerId, UUID applicationId, String decision)
            throws Exception {
        return mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId + "/decision")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\": \"" + decision + "\"}"));
    }

    private UUID createMatching(UUID candidateId, UUID offerId, String resultJson,
            List<FeedbackSpec> feedback, String clarification) {
        UUID candidateProfileId = UUID.randomUUID();
        UUID offerProfileId = UUID.randomUUID();
        UUID matchingId = UUID.randomUUID();
        UUID resultId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO normalized_profile
                    (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at)
                VALUES (?, 1, '3', '{"schemaVersion":"3"}'::jsonb, now(), now(), now())""", candidateProfileId);
        jdbcTemplate.update("INSERT INTO normalized_profile_candidate"
                + " (normalized_profile_id, candidate_id) VALUES (?, ?)", candidateProfileId, candidateId);
        jdbcTemplate.update("""
                INSERT INTO normalized_profile
                    (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at)
                VALUES (?, 1, '2', '{"schemaVersion":"2"}'::jsonb, now(), now(), now())""", offerProfileId);
        jdbcTemplate.update("INSERT INTO normalized_profile_job_offer"
                + " (normalized_profile_id, job_offer_id) VALUES (?, ?)", offerProfileId, offerId);
        jdbcTemplate.update("""
                INSERT INTO matching
                    (id, candidate_id, job_offer_id, candidate_normalized_profile_id, assessment_finished_at,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, now(), now(), now())""",
                matchingId, candidateId, offerId, candidateProfileId);
        jdbcTemplate.update("""
                INSERT INTO matching_result
                    (id, matching_id, version, schema_version, result, job_offer_normalized_profile_id, created_at)
                VALUES (?, ?, 1, '1', ?::jsonb, ?, now())""", resultId, matchingId, resultJson, offerProfileId);
        for (FeedbackSpec item : feedback) {
            jdbcTemplate.update("""
                    INSERT INTO matching_criterion_feedback
                        (id, matching_id, matching_result_id, criterion_key, self_value, comment,
                         created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, now(), now())""",
                    UUID.randomUUID(), matchingId, resultId, item.key(), item.selfValue(), item.comment());
        }
        if (clarification != null) {
            jdbcTemplate.update("""
                    INSERT INTO clarification
                        (id, matching_id, matching_result_id, question, answer, rationale, status, answered_at,
                         created_at)
                    VALUES (?, ?, ?, ?, 'Because I use it daily.', 'To refine the skill assessment.', 2,
                            now(), now())""", UUID.randomUUID(), matchingId, resultId, clarification);
        }
        return matchingId;
    }

    private static String resultJson(int required, int preferred, int languages, int experience,
            int education) {
        return """
                {"sections":[
                  {"section":"required_skills","score":%s,"criteria":[
                    {"key":"skill:java","label":"Java","requirement":"Strong Java","weight":4,"score":%s,
                     "rationale":"Criterion rationale"}]},
                  {"section":"preferred_skills","score":%s,"criteria":[
                    {"key":"skill:kotlin","label":"Kotlin","requirement":null,"weight":1,"score":%s,
                     "rationale":"Kotlin is a plus"}]},
                  {"section":"languages","score":%s,"criteria":[
                    {"key":"language:english","label":"English","requirement":"C1","weight":2,"score":%s,
                     "rationale":"English is required"}]},
                  {"section":"experience","score":%s,"criteria":[
                    {"key":"experience:years","label":"Years of experience","requirement":"5 years","weight":3,
                     "score":%s,"rationale":"Experience matches"}]},
                  {"section":"education","score":%s,"criteria":[
                    {"key":"education:requirement","label":"Education","requirement":"Master","weight":2,
                     "score":%s,"rationale":"Education matches"}]}
                ]}""".formatted(required, required, preferred, preferred, languages, languages,
                experience, experience, education, education);
    }

    private static FeedbackSpec feedback(String key, int selfValue, String comment) {
        return new FeedbackSpec(key, selfValue, comment);
    }

    private record FeedbackSpec(String key, int selfValue, String comment) {
    }

    private static String[] ids(UUID... values) {
        return Arrays.stream(values).map(UUID::toString).toArray(String[]::new);
    }

    private UUID idOf(MvcResult result) throws Exception {
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
    }

    private UUID offerIdOf(String publicId) {
        return jdbcTemplate.queryForObject("SELECT id FROM job_offer WHERE public_id = ?", UUID.class, publicId);
    }

    private String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    private Integer statusOf(UUID applicationId) {
        return jdbcTemplate.queryForObject("SELECT status FROM application WHERE id = ?", Integer.class,
                applicationId);
    }

    private UUID questionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT id FROM job_offer_question WHERE job_offer_id = ? AND label = ?""",
                UUID.class, offerId, label);
    }

    private UUID optionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT o.id FROM job_offer_question_option o
                JOIN job_offer_question q ON q.id = o.question_id
                WHERE q.job_offer_id = ? AND o.label = ?""", UUID.class, offerId, label);
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
}
