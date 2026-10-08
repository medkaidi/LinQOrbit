package com.linqorbit.admin;

import static org.mockito.ArgumentMatchers.any;
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

import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.config.SecurityConfig;
import com.linqorbit.user.UserStatus;

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

    private static JwtRequestPostProcessor adminJwt() {
        return adminJwt(UUID.randomUUID());
    }

    private static JwtRequestPostProcessor adminJwt(UUID adminId) {
        return SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(j -> j.subject(adminId.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
