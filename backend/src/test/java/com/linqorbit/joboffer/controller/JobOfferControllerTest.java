package com.linqorbit.joboffer.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.linqorbit.config.SecurityConfig;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.exception.InvalidJobOfferStatusException;
import com.linqorbit.joboffer.exception.JobOfferAccessDeniedException;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;

@WebMvcTest(JobOfferController.class)
@Import(SecurityConfig.class)
class JobOfferControllerTest {

    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobOfferService jobOfferService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void createRenvoie201() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jobOfferService.create(eq(userId), any(CreateJobOfferRequest.class)))
                .thenReturn(draftResponse());

        mockMvc.perform(post("/api/v1/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\": \"" + UUID.randomUUID() + "\", \"title\": \"Backend Engineer\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.status").value("draft"));
    }

    @Test
    void createRenvoie400SansTitre() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\": \"" + UUID.randomUUID() + "\", \"title\": \"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRenvoie400PourUneCompetenceSansPoids() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "%s",
                                  "title": "Backend Engineer",
                                  "skills": [
                                    {"skillId": "%s", "requirementType": "mandatory"}
                                  ]
                                }
                                """.formatted(UUID.randomUUID(), UUID.randomUUID())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRenvoie404SansProfilRecruteur() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jobOfferService.create(eq(userId), any(CreateJobOfferRequest.class)))
                .thenThrow(new RecruiterNotFoundException());

        mockMvc.perform(post("/api/v1/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"companyId\": \"" + UUID.randomUUID() + "\", \"title\": \"Backend Engineer\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getRenvoie200() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jobOfferService.get(eq(userId), eq(OFFER_ID))).thenReturn(draftResponse());

        mockMvc.perform(get("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(OFFER_ID.toString()));
    }

    @Test
    void getRenvoie404SiInaccessible() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jobOfferService.get(eq(userId), eq(OFFER_ID))).thenThrow(new JobOfferNotFoundException(OFFER_ID));

        mockMvc.perform(get("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNotFound());
    }

    @Test
    void listMineRenvoie200() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jobOfferService.listMine(eq(userId))).thenReturn(List.of(draftResponse()));

        mockMvc.perform(get("/api/v1/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void updateRenvoie204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Backend Engineer\"}"))
                .andExpect(status().isNoContent());

        verify(jobOfferService).update(eq(userId), eq(OFFER_ID), any(UpdateJobOfferRequest.class));
    }

    @Test
    void updateRenvoie403SansDroits() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new JobOfferAccessDeniedException(OFFER_ID, userId))
                .when(jobOfferService).update(eq(userId), eq(OFFER_ID), any(UpdateJobOfferRequest.class));

        mockMvc.perform(put("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Backend Engineer\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateRenvoie409SiPubliee() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new InvalidJobOfferStatusException(com.linqorbit.joboffer.entity.JobOfferStatus.PUBLISHED, "edit"))
                .when(jobOfferService).update(eq(userId), eq(OFFER_ID), any(UpdateJobOfferRequest.class));

        mockMvc.perform(put("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": \"Backend Engineer\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteRenvoie204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/job-offers/" + OFFER_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNoContent());

        verify(jobOfferService).delete(userId, OFFER_ID);
    }

    @Test
    void validatePublishEtCloseRenvoient204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/job-offers/" + OFFER_ID + "/validate")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNoContent());
        verify(jobOfferService).validate(userId, OFFER_ID);

        mockMvc.perform(post("/api/v1/job-offers/" + OFFER_ID + "/publish")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNoContent());
        verify(jobOfferService).publish(userId, OFFER_ID);

        mockMvc.perform(post("/api/v1/job-offers/" + OFFER_ID + "/close")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNoContent());
        verify(jobOfferService).close(userId, OFFER_ID);
    }

    @Test
    void publishRenvoie409DepuisLeDraft() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new InvalidJobOfferStatusException(com.linqorbit.joboffer.entity.JobOfferStatus.DRAFT, "publish"))
                .when(jobOfferService).publish(eq(userId), eq(OFFER_ID));

        mockMvc.perform(post("/api/v1/job-offers/" + OFFER_ID + "/publish")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isConflict());
    }

    private JobOfferResponse draftResponse() {
        return new JobOfferResponse(
                OFFER_ID, UUID.randomUUID(), UUID.randomUUID(), "draft", "Backend Engineer",
                "abcdefghijkl", "backend-engineer", null,
                null, null, null, null, null, null, null, null, null, null,
                new BigDecimal("50000"), new BigDecimal("70000"), "EUR", "year",
                false, List.of(), List.of(), List.of(), List.of(), null, null);
    }
}
