package com.linqorbit.company.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

import com.linqorbit.company.dto.CompanyResponse;
import com.linqorbit.company.dto.CreateCompanyRequest;
import com.linqorbit.company.dto.UpdateCompanyRequest;
import com.linqorbit.company.exception.CompanyAccessDeniedException;
import com.linqorbit.company.exception.CompanyNotFoundException;
import com.linqorbit.company.service.CompanyService;
import com.linqorbit.config.SecurityConfig;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;

@WebMvcTest(CompanyController.class)
@Import(SecurityConfig.class)
class CompanyControllerTest {

    private static final UUID COMPANY_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CompanyService companyService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void createRenvoie201() throws Exception {
        UUID userId = UUID.randomUUID();
        when(companyService.create(eq(userId), any(CreateCompanyRequest.class)))
                .thenReturn(new CompanyResponse(COMPANY_ID, "Acme", null, true));

        mockMvc.perform(post("/api/v1/companies")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme"))
                .andExpect(jsonPath("$.isOwner").value(true));
    }

    @Test
    void createRenvoie400SansName() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/companies")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRenvoie404SansProfilRecruteur() throws Exception {
        UUID userId = UUID.randomUUID();
        when(companyService.create(eq(userId), any(CreateCompanyRequest.class)))
                .thenThrow(new RecruiterNotFoundException());

        mockMvc.perform(post("/api/v1/companies")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void listMineRenvoie200() throws Exception {
        UUID userId = UUID.randomUUID();
        when(companyService.listMine(userId))
                .thenReturn(List.of(new CompanyResponse(COMPANY_ID, "Acme", null, true)));

        mockMvc.perform(get("/api/v1/companies")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Acme"));
    }

    @Test
    void getRenvoie200() throws Exception {
        UUID userId = UUID.randomUUID();
        when(companyService.get(userId, COMPANY_ID))
                .thenReturn(new CompanyResponse(COMPANY_ID, "Acme", "Desc", false));

        mockMvc.perform(get("/api/v1/companies/" + COMPANY_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(false));
    }

    @Test
    void getRenvoie404PourUnNonMembre() throws Exception {
        UUID userId = UUID.randomUUID();
        when(companyService.get(userId, COMPANY_ID)).thenThrow(new CompanyNotFoundException());

        mockMvc.perform(get("/api/v1/companies/" + COMPANY_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No company matches this identifier for your account."));
    }

    @Test
    void updateRenvoie204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/companies/" + COMPANY_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"New name\"}"))
                .andExpect(status().isNoContent());

        verify(companyService).update(eq(userId), eq(COMPANY_ID), any(UpdateCompanyRequest.class));
    }

    @Test
    void updateRenvoie403PourUnMembreNonOwner() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new CompanyAccessDeniedException())
                .when(companyService).update(eq(userId), eq(COMPANY_ID), any(UpdateCompanyRequest.class));

        mockMvc.perform(put("/api/v1/companies/" + COMPANY_ID)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"New name\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Only the company owner can perform this action."));
    }
}
