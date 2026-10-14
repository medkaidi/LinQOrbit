package com.linqorbit.admin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferListItem;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidOfferStatusFilterException;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.NormalizedProfileNotFoundException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.config.SecurityConfig;
import com.linqorbit.user.UserStatus;

import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

@WebMvcTest(AdminController.class)
@Import(SecurityConfig.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminService adminService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void listUsersRenvoie200AvecRoleAdmin() throws Exception {
        when(adminService.listUsers()).thenReturn(List.of(
                new AdminUserResponse(UUID.randomUUID(), "ada@example.com", "Ada", "Lovelace",
                        "ACTIVE", List.of((short) 1))));

        mockMvc.perform(get("/api/v1/admin/users").with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("ada@example.com"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].roles[0]").value(1));
    }

    @Test
    void listUsersRenvoie403SansRoleAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void listUsersRenvoie401SansJeton() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updateUserStatusRenvoie204() throws Exception {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/status", targetId)
                        .with(adminJwt(adminId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"INACTIVE\"}"))
                .andExpect(status().isNoContent());

        verify(adminService).updateUserStatus(eq(targetId), eq(UserStatus.INACTIVE), eq(adminId));
    }

    @Test
    void updateUserStatusRenvoie400QuandLAdminToucheSonPropreCompte() throws Exception {
        doThrow(new SelfStatusChangeException())
                .when(adminService).updateUserStatus(any(), any(), any());

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/status", UUID.randomUUID())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"INACTIVE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Cannot change own status"));
    }

    @Test
    void updateUserStatusRenvoie404QuandLeCompteEstInconnu() throws Exception {
        UUID unknownId = UUID.randomUUID();
        doThrow(new UserNotFoundException(unknownId))
                .when(adminService).updateUserStatus(any(), any(), any());

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/status", unknownId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"ACTIVE\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("User not found"));
    }

    @Test
    void skillSuggestionsRenvoie200AvecRoleAdmin() throws Exception {
        when(adminService.listSkillSuggestions()).thenReturn(List.of(
                new AdminSkillSuggestionResponse(UUID.randomUUID(), "Rust", UUID.randomUUID(),
                        "Ada", "Lovelace", "ada@example.com",
                        java.time.LocalDateTime.of(2026, 10, 2, 10, 0))));

        mockMvc.perform(get("/api/v1/admin/skill-suggestions").with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Rust"))
                .andExpect(jsonPath("$[0].candidateEmail").value("ada@example.com"));
    }

    @Test
    void approveSkillSuggestionRenvoie204() throws Exception {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/approve", suggestionId)
                        .with(adminJwt(adminId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"Design\", \"skillType\": \"tech\"}"))
                .andExpect(status().isNoContent());

        verify(adminService).approveSuggestion(eq(suggestionId), eq("Design"), eq("tech"), eq(adminId));
    }

    @Test
    void approveSkillSuggestionRenvoie400QuandCorpsInvalide() throws Exception {
        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/approve", UUID.randomUUID())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"\", \"skillType\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"));
    }

    @Test
    void approveSkillSuggestionRenvoie400QuandCategorieInconnue() throws Exception {
        doThrow(new InvalidSkillCategoryException("Game Design"))
                .when(adminService).approveSuggestion(any(), any(), any(), any());

        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/approve", UUID.randomUUID())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"Game Design\", \"skillType\": \"tech\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unknown skill category"));
    }

    @Test
    void approveSkillSuggestionRenvoie403SansRoleAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/approve", UUID.randomUUID())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\": \"Design\", \"skillType\": \"tech\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void linkSkillSuggestionRenvoie204() throws Exception {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/link", suggestionId)
                        .with(adminJwt(adminId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skillId\": \"" + skillId + "\"}"))
                .andExpect(status().isNoContent());

        verify(adminService).linkSuggestion(eq(suggestionId), eq(skillId), eq(adminId));
    }

    @Test
    void rejectSkillSuggestionRenvoie204() throws Exception {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/reject", suggestionId)
                        .with(adminJwt(adminId)))
                .andExpect(status().isNoContent());

        verify(adminService).rejectSuggestion(eq(suggestionId), eq(adminId));
    }

    @Test
    void rejectSkillSuggestionRenvoie404QuandSuggestionInconnue() throws Exception {
        UUID unknownId = UUID.randomUUID();
        doThrow(new SuggestionNotFoundException(unknownId))
                .when(adminService).rejectSuggestion(any(), any());

        mockMvc.perform(post("/api/v1/admin/skill-suggestions/{id}/reject", unknownId)
                        .with(adminJwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Skill suggestion not found"));
    }

    @Test
    void getUserDetailRenvoie200AvecRoleAdmin() throws Exception {
        UUID userId = UUID.randomUUID();
        when(adminService.getUserDetail(userId)).thenReturn(new AdminUserDetailResponse(
                userId, "ada@example.com", "Ada", "Lovelace", "ACTIVE", List.of((short) 1),
                "+33612345678", "female", "FR", "Paris", "FR",
                java.time.LocalDateTime.of(2026, 1, 15, 10, 0), true, false));

        mockMvc.perform(get("/api/v1/admin/users/{userId}", userId).with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                .andExpect(jsonPath("$.sex").value("female"))
                .andExpect(jsonPath("$.hasCandidateProfile").value(true))
                .andExpect(jsonPath("$.hasRecruiterProfile").value(false));
    }

    @Test
    void getUserDetailRenvoie404QuandCompteInconnu() throws Exception {
        UUID unknownId = UUID.randomUUID();
        doThrow(new UserNotFoundException(unknownId))
                .when(adminService).getUserDetail(unknownId);

        mockMvc.perform(get("/api/v1/admin/users/{userId}", unknownId).with(adminJwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("User not found"));
    }

    @Test
    void candidateNormalizedProfileRenvoie200AvecContenu() throws Exception {
        UUID userId = UUID.randomUUID();
        ObjectNode content = JsonNodeFactory.instance.objectNode();
        content.put("seniority", "mid");
        when(adminService.getCandidateNormalizedProfile(userId)).thenReturn(
                new AdminNormalizedProfileResponse(userId, 3, "2",
                        java.time.LocalDateTime.of(2026, 10, 1, 12, 0), "done", content));

        mockMvc.perform(get("/api/v1/admin/users/{userId}/normalized-profile", userId)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3))
                .andExpect(jsonPath("$.schemaVersion").value("2"))
                .andExpect(jsonPath("$.jobStatus").value("done"))
                .andExpect(jsonPath("$.content.seniority").value("mid"));
    }

    @Test
    void candidateNormalizedProfileRenvoie404SansFiche() throws Exception {
        doThrow(new NormalizedProfileNotFoundException(true))
                .when(adminService).getCandidateNormalizedProfile(any());

        mockMvc.perform(get("/api/v1/admin/users/{userId}/normalized-profile", UUID.randomUUID())
                        .with(adminJwt()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Normalized profile not found"));
    }

    @Test
    void listJobOffersRenvoie200AvecParametres() throws Exception {
        when(adminService.listJobOffers("published", 1, 10))
                .thenReturn(new AdminJobOfferPageResponse(List.of(
                        new AdminJobOfferListItem(UUID.randomUUID(), "Dev Java", "published",
                                "Acme", "abc123", "dev-java",
                                java.time.LocalDateTime.of(2026, 10, 1, 8, 0),
                                java.time.LocalDateTime.of(2026, 10, 1, 9, 0),
                                java.time.LocalDate.of(2026, 12, 31),
                                java.time.LocalDateTime.of(2026, 10, 1, 10, 0), "done")),
                        1, 10, 42));

        mockMvc.perform(get("/api/v1/admin/job-offers")
                        .param("status", "published").param("page", "1").param("size", "10")
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Dev Java"))
                .andExpect(jsonPath("$.items[0].companyName").value("Acme"))
                .andExpect(jsonPath("$.items[0].normalizationJobStatus").value("done"))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.total").value(42));
    }

    @Test
    void listJobOffersRenvoie400QuandFiltreInconnu() throws Exception {
        doThrow(new InvalidOfferStatusFilterException("archived"))
                .when(adminService).listJobOffers(any(), anyInt(), any());

        mockMvc.perform(get("/api/v1/admin/job-offers").param("status", "archived")
                        .with(adminJwt()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unsupported status filter"));
    }

    @Test
    void getJobOfferDetailRenvoie200() throws Exception {
        UUID offerId = UUID.randomUUID();
        when(adminService.getJobOfferDetail(offerId)).thenReturn(new AdminJobOfferDetailResponse(
                offerId, "closed", java.time.LocalDateTime.of(2026, 9, 1, 8, 0),
                java.time.LocalDateTime.of(2026, 9, 2, 9, 0), null));

        mockMvc.perform(get("/api/v1/admin/job-offers/{offerId}", offerId).with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(offerId.toString()))
                .andExpect(jsonPath("$.status").value("closed"));
    }

    @Test
    void offerNormalizedProfileRenvoie200AvecContenu() throws Exception {
        UUID offerId = UUID.randomUUID();
        ObjectNode content = JsonNodeFactory.instance.objectNode();
        content.put("title", "Dev Java");
        when(adminService.getOfferNormalizedProfile(offerId)).thenReturn(
                new AdminNormalizedProfileResponse(offerId, 1, "1",
                        java.time.LocalDateTime.of(2026, 10, 2, 9, 0), "failed", content));

        mockMvc.perform(get("/api/v1/admin/job-offers/{offerId}/normalized-profile", offerId)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schemaVersion").value("1"))
                .andExpect(jsonPath("$.jobStatus").value("failed"))
                .andExpect(jsonPath("$.content.title").value("Dev Java"));
    }

    @Test
    void adminJobEndpointsRenvoient403SansRoleAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users/{userId}", UUID.randomUUID())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/job-offers")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/job-offers/{offerId}", UUID.randomUUID())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isForbidden());
    }

    private static JwtRequestPostProcessor adminJwt() {
        return adminJwt(UUID.randomUUID());
    }

    private static JwtRequestPostProcessor adminJwt(UUID adminId) {
        return SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(j -> j.subject(adminId.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
