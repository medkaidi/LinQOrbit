package com.linqorbit.auth;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.ChangePasswordRequest;
import com.linqorbit.auth.dto.UserResponse;
import com.linqorbit.auth.exception.AccountNotActiveException;
import com.linqorbit.auth.exception.EmailAlreadyExistsException;
import com.linqorbit.auth.exception.InvalidCredentialsException;
import com.linqorbit.auth.exception.WrongCurrentPasswordException;
import com.linqorbit.config.SecurityConfig;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerTest {

    private static final String SIGNUP_JSON = """
            {
              "email": "ada@example.com",
              "password": "secret123",
              "firstName": "Ada",
              "lastName": "Lovelace",
              "phone": "+1 555 000 0000",
              "sex": "female",
              "homeCountry": "FR",
              "currentCity": "Paris",
              "currentCountry": "FR"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void signupRenvoie201AvecLeTokenEtLUtilisateur() throws Exception {
        UserResponse user = new UserResponse(UUID.randomUUID(), "ada@example.com", "Ada", "Lovelace",
                "female", "+1 555 000 0000", "FR", "Paris", "FR");
        when(authService.signup(any())).thenReturn(new AuthResponse("jwt-token", user));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SIGNUP_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.user.email").value("ada@example.com"))
                .andExpect(jsonPath("$.user.sex").value("female"))
                .andExpect(jsonPath("$.user.homeCountry").value("FR"));
    }

    @Test
    void signupRenvoie400QuandLesChampsSontInvalides() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"pas-un-email\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.detail").value(containsString("password")));
    }

    @Test
    void signupRenvoie409QuandLEmailExisteDeja() throws Exception {
        when(authService.signup(any())).thenThrow(new EmailAlreadyExistsException("ada@example.com"));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SIGNUP_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Email already registered"))
                .andExpect(jsonPath("$.detail").value("An account already exists for this email."));
    }

    @Test
    void loginRenvoie200AvecLeToken() throws Exception {
        UserResponse user = new UserResponse(UUID.randomUUID(), "ada@example.com", "Ada", "Lovelace",
                "female", "+1 555 000 0000", "FR", "Paris", "FR");
        when(authService.login(any())).thenReturn(new AuthResponse("jwt-token", user));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"ada@example.com\", \"password\": \"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.user.email").value("ada@example.com"));
    }

    @Test
    void loginRenvoie401QuandLesIdentifiantsSontInvalides() throws Exception {
        when(authService.login(any())).thenThrow(new InvalidCredentialsException());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"ada@example.com\", \"password\": \"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Invalid credentials"));
    }

    @Test
    void loginRenvoie403QuandLeCompteEstInactif() throws Exception {
        when(authService.login(any())).thenThrow(new AccountNotActiveException());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"ada@example.com\", \"password\": \"secret123\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Account not active"));
    }

    @Test
    void lesEndpointsAuthSontAccessiblesSansAuthentification() throws Exception {
        when(authService.login(any())).thenReturn(
                new AuthResponse("jwt-token", new UserResponse(UUID.randomUUID(), "ada@example.com",
                        "Ada", "Lovelace", "female", null, "FR", "Paris", "FR")));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"ada@example.com\", \"password\": \"secret123\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void meRenvoie200AvecLeProfil() throws Exception {
        UUID userId = UUID.randomUUID();
        when(authService.getProfile(userId)).thenReturn(
                new UserResponse(userId, "ada@example.com", "Ada", "Lovelace",
                        "female", "+1 555 000 0000", "FR", "Paris", "FR"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.email").value("ada@example.com"))
                .andExpect(jsonPath("$.firstName").value("Ada"))
                .andExpect(jsonPath("$.currentCity").value("Paris"));
    }

    @Test
    void meRenvoie401SansJeton() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordRenvoie204() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"secret123\", \"newPassword\": \"nouveau-mdp-1\"}"))
                .andExpect(status().isNoContent());

        verify(authService).changePassword(eq(userId), any(ChangePasswordRequest.class));
    }

    @Test
    void changePasswordRenvoie400QuandLeCorpsEstInvalide() throws Exception {
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.detail").value(containsString("newPassword")));
    }

    @Test
    void changePasswordRenvoie403QuandLeMotDePasseActuelEstFaux() throws Exception {
        doThrow(new WrongCurrentPasswordException())
                .when(authService).changePassword(any(), any(ChangePasswordRequest.class));

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"wrong\", \"newPassword\": \"nouveau-mdp-1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Wrong current password"))
                .andExpect(jsonPath("$.detail").value("The current password is incorrect."));
    }

    @Test
    void changePasswordRenvoie401SansJeton() throws Exception {
        mockMvc.perform(post("/api/v1/auth/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"secret123\", \"newPassword\": \"nouveau-mdp-1\"}"))
                .andExpect(status().isUnauthorized());
    }
}
