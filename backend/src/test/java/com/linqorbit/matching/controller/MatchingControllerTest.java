package com.linqorbit.matching.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.config.SecurityConfig;
import com.linqorbit.matching.dto.MatchingCriterionView;
import com.linqorbit.matching.dto.MatchingFeedbackResponse;
import com.linqorbit.matching.dto.MatchingFeedbackView;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.MatchingSectionView;
import com.linqorbit.matching.exception.InvalidMatchingException;
import com.linqorbit.matching.exception.MatchingNotFoundException;
import com.linqorbit.matching.service.MatchingService;

@WebMvcTest(MatchingController.class)
@Import(SecurityConfig.class)
class MatchingControllerTest {

    private static final String PUBLIC_ID = "abc123def456";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MatchingService matchingService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void lancementEtLectureRenvoient200AvecLesScoresParCritere() throws Exception {
        UUID userId = UUID.randomUUID();
        MatchingResponse response = new MatchingResponse(UUID.randomUUID(), "done", List.of(
                new MatchingSectionView("required_skills", List.of(new MatchingCriterionView("skill:java", "Java",
                        80)))), false, null, List.of());
        when(matchingService.start(userId, PUBLIC_ID)).thenReturn(response);
        when(matchingService.getCurrent(userId, PUBLIC_ID)).thenReturn(response);

        mockMvc.perform(post("/api/v1/matchings").with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + PUBLIC_ID + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("done"))
                .andExpect(jsonPath("$.sections[0].criteria[0].score").value(80));
        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID).with(jwt(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections[0].section").value("required_skills"));
    }

    @Test
    void erreursMetierRenduesAvecLeurDetail() throws Exception {
        UUID userId = UUID.randomUUID();
        when(matchingService.start(eq(userId), eq(PUBLIC_ID)))
                .thenThrow(new InvalidMatchingException(HttpStatus.CONFLICT, "The match is closed once your "
                        + "application is submitted."));
        when(matchingService.getCurrent(eq(userId), eq(PUBLIC_ID)))
                .thenThrow(new MatchingNotFoundException("none"));

        mockMvc.perform(post("/api/v1/matchings").with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + PUBLIC_ID + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("The match is closed once your application is submitted."));
        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID).with(jwt(userId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No match has been run for this job offer yet."));
    }

    @Test
    void corpsInvalideEt401SansJeton() throws Exception {
        mockMvc.perform(post("/api/v1/matchings").with(jwt(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/matchings").with(jwt(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/matchings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + PUBLIC_ID + "\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID)).andExpect(status().isUnauthorized());
    }

    @Test
    void clarificationsEtContestationExigentUnJetonEtUnCorpsValide() throws Exception {
        String offer = "/api/v1/matchings/offer/" + PUBLIC_ID;
        String clarification = offer + "/clarifications/" + UUID.randomUUID();
        mockMvc.perform(post(clarification + "/answer").contentType(MediaType.APPLICATION_JSON)
                .content("{\"answer\": \"Yes\"}")).andExpect(status().isUnauthorized());
        mockMvc.perform(post(clarification + "/skip")).andExpect(status().isUnauthorized());
        mockMvc.perform(post(offer + "/assessment/finish")).andExpect(status().isUnauthorized());
        mockMvc.perform(put(offer + "/feedback").contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\": []}")).andExpect(status().isUnauthorized());

        // Corps invalides : 400 de validation avant tout appel au service.
        UUID userId = UUID.randomUUID();
        for (String body : new String[] {"{}", "{\"answer\": \"  \"}"}) {
            mockMvc.perform(post(clarification + "/answer").with(jwt(userId))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(put(offer + "/feedback").with(jwt(userId)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\": [{\"criterionKey\": \"skill:java\", \"selfValue\": 101}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reponseEtSkip202FinEtContestationRendentLeurCorps() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID clarificationId = UUID.randomUUID();
        MatchingResponse pending = new MatchingResponse(UUID.randomUUID(), "pending", List.of(), false, null, List.of());
        when(matchingService.answerClarification(userId, PUBLIC_ID, clarificationId, "Yes")).thenReturn(pending);
        when(matchingService.skipClarification(userId, PUBLIC_ID, clarificationId)).thenReturn(pending);
        when(matchingService.saveFeedback(eq(userId), eq(PUBLIC_ID), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MatchingFeedbackResponse(List.of(new MatchingFeedbackView("skill:java", 70, null))));
        String offer = "/api/v1/matchings/offer/" + PUBLIC_ID;

        mockMvc.perform(post(offer + "/clarifications/" + clarificationId + "/answer").with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answer\": \"Yes\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("pending"));
        mockMvc.perform(post(offer + "/clarifications/" + clarificationId + "/skip").with(jwt(userId)))
                .andExpect(status().isAccepted());
        mockMvc.perform(post(offer + "/assessment/finish").with(jwt(userId))).andExpect(status().isNoContent());
        mockMvc.perform(put(offer + "/feedback").with(jwt(userId)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\": [{\"criterionKey\": \"skill:java\", \"selfValue\": 70}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].selfValue").value(70));
    }

    @Test
    void fluxDeStatutOuvertEnSseAvecJeton() throws Exception {
        UUID userId = UUID.randomUUID();
        when(matchingService.subscribe(userId, PUBLIC_ID)).thenReturn(new SseEmitter());

        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID + "/events").with(jwt(userId))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted());
    }

    @Test
    void fluxRefuseAvantAbonnementRenduEnProblemDetailMalgreLAcceptSse() throws Exception {
        UUID userId = UUID.randomUUID();
        when(matchingService.subscribe(eq(userId), eq(PUBLIC_ID)))
                .thenThrow(new MatchingNotFoundException("none"))
                .thenThrow(new InvalidMatchingException(HttpStatus.CONFLICT,
                        "The match is closed once your application is submitted."));

        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID + "/events").with(jwt(userId))
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("No match has been run for this job offer yet."));
        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID + "/events").with(jwt(userId))
                        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/api/v1/matchings/offer/" + PUBLIC_ID + "/events")
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());
    }

    private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwt(UUID userId) {
        return SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()));
    }
}
