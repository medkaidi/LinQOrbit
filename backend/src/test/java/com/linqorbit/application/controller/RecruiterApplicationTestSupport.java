package com.linqorbit.application.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
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

import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
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
 * Échafaudage partagé des tests d'intégration de la vue recruteur des
 * candidatures (T-66, T-86) sur PostgreSQL réel : comptes, company, offre
 * publiée, candidature transmise, matching et résultat épinglé. Les tests
 * eux-mêmes restent dans leurs classes.
 */
abstract class RecruiterApplicationTestSupport extends ApplicationStorageTestSupport {

    static final String OFFERS_PATH = "/api/v1/job-offers";
    static final String ATTACHMENTS_PATH = "/api/v1/candidates/me/attachments";

    static final String SKILL_ID = "a0000000-0000-4000-8000-000000000001";
    static final String CONTRACT_TYPE_ID = "b0000000-0000-4000-8000-000000000001";
    static final String EMPLOYMENT_TYPE_ID = "b1000000-0000-4000-8000-000000000001";
    static final String WORK_MODE_ID = "b2000000-0000-4000-8000-000000000001";

    @Autowired
    protected MockMvc mockMvc;
    @Autowired
    protected ObjectMapper objectMapper;
    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @MockitoBean
    protected NormalizationWorker normalizationWorker;

    protected final List<UUID> createdUserIds = new ArrayList<>();
    protected final List<UUID> createdCompanyIds = new ArrayList<>();
    protected final List<UUID> createdOfferIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID offerId : createdOfferIds) {
            // L'application porte la FK vers le matching : elle part d'abord.
            jdbcTemplate.update("DELETE FROM application WHERE job_offer_id = ?", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_criterion_report_review rv
                    USING matching_criterion_report r, matching m
                    WHERE rv.report_id = r.id AND r.matching_id = m.id AND m.job_offer_id = ?""", offerId);
            jdbcTemplate.update("""
                    DELETE FROM matching_criterion_report r
                    USING matching m
                    WHERE r.matching_id = m.id AND m.job_offer_id = ?""", offerId);
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
            jdbcTemplate.update("DELETE FROM matching_criterion_report_review WHERE reviewer_user_id = ?",
                    candidateId);
            jdbcTemplate.update("DELETE FROM matching_criterion_report_review WHERE report_id IN"
                    + " (SELECT id FROM matching_criterion_report WHERE matching_id IN"
                    + " (SELECT id FROM matching WHERE candidate_id = ?))", candidateId);
            jdbcTemplate.update("DELETE FROM matching_criterion_report WHERE matching_id IN"
                    + " (SELECT id FROM matching WHERE candidate_id = ?)", candidateId);
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

    protected record Owner(String token, UUID companyId) {
    }

    protected record Account(String token, UUID userId) {
    }

    protected record FeedbackSpec(String key, int selfValue, String comment) {
    }

    protected Owner ownerWithCompany(String companyName) throws Exception {
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

    protected Account memberOf(UUID companyId) throws Exception {
        Account member = signupRecruiter("Mia", "Member");
        jdbcTemplate.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, false)",
                companyId, member.userId());
        return member;
    }

    protected Account signupRecruiter(String firstName, String lastName) throws Exception {
        Account account = signup(firstName, lastName);
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + account.token()))
                .andExpect(status().isCreated());
        return account;
    }

    protected Account signup(String firstName, String lastName) throws Exception {
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

    protected UUID createOffer(String token, UUID companyId, String title, String questionsArrayJson)
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

    protected void publish(String token, UUID offerId) throws Exception {
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/validate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    protected UUID draftAndMatch(Account candidate, UUID cvId, String publicId, String resultJson,
            List<FeedbackSpec> feedback, String clarification) throws Exception {
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());
        createMatching(candidate.userId(), offerIdOf(publicId), resultJson, feedback, clarification);
        submit(candidate.token(), applicationId, null).andExpect(status().isOk());
        return applicationId;
    }

    protected UUID submitDirect(Account candidate, UUID cvId, String publicId) throws Exception {
        UUID applicationId = idOf(saveDraft(candidate.token(), publicId, "[]")
                .andExpect(status().isOk()).andReturn());
        submit(candidate.token(), applicationId, null).andExpect(status().isOk());
        return applicationId;
    }

    protected ResultActions saveDraft(String token, String publicId, String answersJson) throws Exception {
        return mockMvc.perform(put("/api/v1/applications/draft")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"jobPublicId\": \"" + publicId + "\", \"answers\": " + answersJson + "}"));
    }

    protected ResultActions submit(String token, UUID applicationId, String bodyJson) throws Exception {
        var request = post("/api/v1/applications/" + applicationId + "/submit")
                .header("Authorization", "Bearer " + token);
        if (bodyJson != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(bodyJson);
        }
        return mockMvc.perform(request);
    }

    protected ResultActions decide(String token, UUID offerId, UUID applicationId, String decision)
            throws Exception {
        return mockMvc.perform(post(OFFERS_PATH + "/" + offerId + "/applications/" + applicationId + "/decision")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\": \"" + decision + "\"}"));
    }

    protected UUID createMatching(UUID candidateId, UUID offerId, String resultJson,
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

    /** Résultat d'un matching à cinq sections (une critère par section). */
    protected static String resultJson(int required, int preferred, int languages, int experience,
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

    protected static FeedbackSpec feedback(String key, int selfValue, String comment) {
        return new FeedbackSpec(key, selfValue, comment);
    }

    protected static String[] ids(UUID... values) {
        return Arrays.stream(values).map(UUID::toString).toArray(String[]::new);
    }

    protected UUID idOf(MvcResult result) throws Exception {
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("id").asText());
    }

    protected UUID offerIdOf(String publicId) {
        return jdbcTemplate.queryForObject("SELECT id FROM job_offer WHERE public_id = ?", UUID.class, publicId);
    }

    protected String publicIdOf(UUID offerId) {
        return jdbcTemplate.queryForObject("SELECT public_id FROM job_offer WHERE id = ?", String.class, offerId);
    }

    protected Integer statusOf(UUID applicationId) {
        return jdbcTemplate.queryForObject("SELECT status FROM application WHERE id = ?", Integer.class,
                applicationId);
    }

    protected UUID questionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT id FROM job_offer_question WHERE job_offer_id = ? AND label = ?""",
                UUID.class, offerId, label);
    }

    protected UUID optionIdOf(UUID offerId, String label) {
        return jdbcTemplate.queryForObject("""
                SELECT o.id FROM job_offer_question_option o
                JOIN job_offer_question q ON q.id = o.question_id
                WHERE q.job_offer_id = ? AND o.label = ?""", UUID.class, offerId, label);
    }

    protected UUID uploadCv(String token) throws Exception {
        MvcResult result = mockMvc.perform(multipart(ATTACHMENTS_PATH)
                        .file(new MockMultipartFile("file", "candidate-cv.pdf", "application/pdf",
                                "%PDF-1.4 candidate".getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    protected List<Integer> twoAtOnce(Callable<Integer> call) throws Exception {
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
