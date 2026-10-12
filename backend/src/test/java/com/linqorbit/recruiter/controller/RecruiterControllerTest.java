package com.linqorbit.recruiter.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.dto.UpdateRecruiterRequest;
import com.linqorbit.recruiter.exception.RecruiterAlreadyExistsException;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.service.RecruiterService;

@WebMvcTest(RecruiterController.class)
@Import(SecurityConfig.class)
class RecruiterControllerTest {

    private static final String ME_PATH = "/api/v1/recruiters/me";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RecruiterService recruiterService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void createRenvoie201AvecLeProfil() throws Exception {
        UUID userId = UUID.randomUUID();
        when(recruiterService.create(userId)).thenReturn(new RecruiterResponse(userId, null, null));

        mockMvc.perform(post(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(userId.toString()));
    }

    @Test
    void createRenvoie409QuandLeProfilExisteDeja() throws Exception {
        UUID userId = UUID.randomUUID();
        when(recruiterService.create(userId)).thenThrow(new RecruiterAlreadyExistsException());

        mockMvc.perform(post(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("This account already has a recruiter profile."));
    }

    @Test
    void getRenvoie200AvecLeProfil() throws Exception {
        UUID userId = UUID.randomUUID();
        when(recruiterService.get(userId))
                .thenReturn(new RecruiterResponse(userId, "Talent Acquisition", "Hello"));

        mockMvc.perform(get(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headline").value("Talent Acquisition"))
                .andExpect(jsonPath("$.bio").value("Hello"));
    }

    @Test
    void getRenvoie404QuandLeProfilNExistePas() throws Exception {
        UUID userId = UUID.randomUUID();
        when(recruiterService.get(userId)).thenThrow(new RecruiterNotFoundException());

        mockMvc.perform(get(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("This account does not have a recruiter profile yet."));
    }

    @Test
    void updateRenvoie204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headline\": \"Lead Recruiter\", \"bio\": \"Tech recruiting\"}"))
                .andExpect(status().isNoContent());

        verify(recruiterService).update(eq(userId), any(UpdateRecruiterRequest.class));
    }

    @Test
    void updateRenvoie400SiHeadlineTropLongue() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put(ME_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headline\": \"" + "x".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void meRenvoie401SansJeton() throws Exception {
        mockMvc.perform(get(ME_PATH)).andExpect(status().isUnauthorized());
    }
}
