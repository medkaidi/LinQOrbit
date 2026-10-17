package com.linqorbit.application.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
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

import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationCvSummary;
import com.linqorbit.application.dto.ApplicationJobSummary;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.exception.ApplicationNotFoundException;
import com.linqorbit.application.exception.InvalidApplicationException;
import com.linqorbit.application.service.ApplicationService;
import com.linqorbit.config.SecurityConfig;

@WebMvcTest(ApplicationController.class)
@Import(SecurityConfig.class)
class ApplicationControllerTest {

    private static final String PUBLIC_ID = "abc123def456";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ApplicationService applicationService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void submitRenvoie201() throws Exception {
        UUID userId = UUID.randomUUID();
        when(applicationService.submit(eq(userId), any())).thenReturn(response());

        mockMvc.perform(post("/api/v1/applications")
                        .with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPublicId": "%s",
                                  "cvAttachmentId": "%s",
                                  "answers": [
                                    {"questionId": "%s", "text": "Hello"}
                                  ]
                                }
                                """.formatted(PUBLIC_ID, UUID.randomUUID(), UUID.randomUUID())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("submitted"))
                .andExpect(jsonPath("$.job.publicId").value(PUBLIC_ID))
                .andExpect(jsonPath("$.answers.length()").value(0));
    }

    @Test
    void submitAccepteDesReponsesAbsentes() throws Exception {
        UUID userId = UUID.randomUUID();
        when(applicationService.submit(eq(userId), any())).thenReturn(response());

        mockMvc.perform(post("/api/v1/applications")
                        .with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + PUBLIC_ID + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void submitRenvoie400SansIdentifiantPublic() throws Exception {
        mockMvc.perform(post("/api/v1/applications")
                        .with(jwt(UUID.randomUUID()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitRenvoie404OffreIndisponibleEt409Doublon() throws Exception {
        UUID userId = UUID.randomUUID();
        when(applicationService.submit(eq(userId), any()))
                .thenThrow(new InvalidApplicationException(HttpStatus.NOT_FOUND,
                        "This job offer is no longer available."))
                .thenThrow(new InvalidApplicationException(HttpStatus.CONFLICT,
                        "You have already applied to this job offer."));

        String body = "{\"jobPublicId\": \"" + PUBLIC_ID + "\"}";
        mockMvc.perform(post("/api/v1/applications").with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("This job offer is no longer available."));
        mockMvc.perform(post("/api/v1/applications").with(jwt(userId))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You have already applied to this job offer."));
    }

    @Test
    void mineRenvoieLaListeEtContextLeContexte() throws Exception {
        UUID userId = UUID.randomUUID();
        when(applicationService.listMine(userId)).thenReturn(List.of(response()));
        when(applicationService.getContext(userId, PUBLIC_ID)).thenReturn(
                new ApplicationContextResponse(
                        new ApplicationJobSummary(PUBLIC_ID, "backend-engineer", "Backend Engineer", "Acme"),
                        List.of(), null, null));

        mockMvc.perform(get("/api/v1/applications/mine").with(jwt(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("submitted"));
        mockMvc.perform(get("/api/v1/applications/context/" + PUBLIC_ID).with(jwt(userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.questions.length()").value(0));
    }

    @Test
    void withdrawRenvoie204Puis404Et409() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        doThrow(new ApplicationNotFoundException("unknown"))
                .doThrow(new InvalidApplicationException(HttpStatus.CONFLICT,
                        "This application can no longer be withdrawn."))
                .doNothing()
                .when(applicationService).withdraw(eq(userId), eq(applicationId));

        mockMvc.perform(post("/api/v1/applications/" + applicationId + "/withdraw").with(jwt(userId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/applications/" + applicationId + "/withdraw").with(jwt(userId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This application can no longer be withdrawn."));
        mockMvc.perform(post("/api/v1/applications/" + applicationId + "/withdraw").with(jwt(userId)))
                .andExpect(status().isNoContent());
    }

    @Test
    void identifiantNonUuidEtRequetesSansJeton() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/applications/not-a-uuid/withdraw").with(jwt(userId)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/applications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jobPublicId\": \"" + PUBLIC_ID + "\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/applications/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/applications/context/" + PUBLIC_ID)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/applications/" + UUID.randomUUID() + "/withdraw"))
                .andExpect(status().isUnauthorized());
    }

    private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwt(UUID userId) {
        return SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()));
    }

    private static ApplicationResponse response() {
        return new ApplicationResponse(UUID.randomUUID(), "submitted", LocalDateTime.now(), LocalDateTime.now(),
                new ApplicationJobSummary(PUBLIC_ID, "backend-engineer", "Backend Engineer", "Acme"),
                new ApplicationCvSummary(UUID.randomUUID(), "cv.pdf"), List.of());
    }
}
