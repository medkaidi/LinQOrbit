package com.linqorbit.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserSex;
import com.linqorbit.user.UserStatus;

@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JwtDecoder jwtDecoder;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        userRepository.deleteAllById(createdUserIds);
        createdUserIds.clear();
    }

    @Test
    void signupLoginEtValidationDuToken() throws Exception {
        String email = "flow-" + UUID.randomUUID() + "@example.com";

        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "female")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.sex").value("female"))
                .andReturn();

        JsonNode signupBody = objectMapper.readTree(signup.getResponse().getContentAsString());
        String signupToken = signupBody.get("token").asText();
        UUID userId = UUID.fromString(signupBody.get("user").get("id").asText());
        createdUserIds.add(userId);

        Jwt jwt = jwtDecoder.decode(signupToken);
        assertThat(jwt.getSubject()).isEqualTo(userId.toString());
        assertThat(jwt.getClaimAsString("email")).isEqualTo(email);
        assertThat(jwt.getExpiresAt()).isAfter(jwt.getIssuedAt());

        assertThat(userRepository.findByEmail(email)).isPresent();
        assertThat(userRepository.findByEmail(email).orElseThrow().getSex()).isEqualTo(UserSex.FEMALE);
        Short storedSex = jdbcTemplate.queryForObject(
                "SELECT sex FROM users WHERE id = ?", Short.class, userId);
        assertThat(storedSex).isEqualTo((short) 2);

        mockMvc.perform(post("/api/v1/auth/login")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "secret123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(userId.toString()));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "male")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Email already registered"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "mauvais-mdp")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Invalid credentials"));
    }

    @Test
    void loginRejetteUnCompteInactif() throws Exception {
        String email = "inactive-" + UUID.randomUUID() + "@example.com";
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode("secret123"))
                .firstName("Ina")
                .lastName("Ctive")
                .status(UserStatus.SUSPENDED)
                .build();
        user = userRepository.save(user);
        createdUserIds.add(user.getId());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "secret123")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Account not active"));
    }

    @Test
    void requeteAvecUnBearerInvalideRenvoie401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Authorization", "Bearer pas-un-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("someone@example.com", "secret123")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requeteAvecUnBearerValideEstAcceptee() throws Exception {
        String email = "bearer-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "male")))
                .andExpect(status().isCreated())
                .andReturn();
        createdUserIds.add(UUID.fromString(
                objectMapper.readTree(signup.getResponse().getContentAsString())
                        .get("user").get("id").asText()));
        String token = objectMapper.readTree(signup.getResponse().getContentAsString())
                .get("token").asText();

        mockMvc.perform(post("/api/v1/auth/login")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "secret123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void profilEtChangementDeMotDePasseAvecUnVraiJeton() throws Exception {
        String email = "profile-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "female")))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode signupBody = objectMapper.readTree(signup.getResponse().getContentAsString());
        String token = signupBody.get("token").asText();
        UUID userId = UUID.fromString(signupBody.get("user").get("id").asText());
        createdUserIds.add(userId);

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.firstName").value("Ada"));

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"secret123\", \"newPassword\": \"nouveau-mdp-1\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "secret123")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Invalid credentials"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "nouveau-mdp-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void miseAJourDuProfilSeRefloteDansGetMe() throws Exception {
        String email = "identity-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "female")))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode signupBody = objectMapper.readTree(signup.getResponse().getContentAsString());
        String token = signupBody.get("token").asText();
        createdUserIds.add(UUID.fromString(signupBody.get("user").get("id").asText()));

        mockMvc.perform(put("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Augusta Ada",
                                  "lastName": "King",
                                  "phone": "+33 6 11 22 33 44",
                                  "currentCity": "Lyon",
                                  "currentCountry": "FR"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Augusta Ada"))
                .andExpect(jsonPath("$.currentCity").value("Lyon"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Augusta Ada"))
                .andExpect(jsonPath("$.lastName").value("King"))
                .andExpect(jsonPath("$.phone").value("+33 6 11 22 33 44"))
                .andExpect(jsonPath("$.currentCity").value("Lyon"))
                .andExpect(jsonPath("$.currentCountry").value("FR"))
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void changePasswordRejetteLeMauvaisMotDePasseActuel() throws Exception {
        String email = "wrongcurrent-" + UUID.randomUUID() + "@example.com";
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, "male")))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode signupBody = objectMapper.readTree(signup.getResponse().getContentAsString());
        String token = signupBody.get("token").asText();
        createdUserIds.add(UUID.fromString(signupBody.get("user").get("id").asText()));

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"mauvais-mdp\", \"newPassword\": \"nouveau-mdp-1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Wrong current password"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, "secret123")))
                .andExpect(status().isOk());
    }

    @Test
    void meSansJetonRenvoie401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    private static String signupJson(String email, String sex) {
        return """
                {
                  "email": "%s",
                  "password": "secret123",
                  "firstName": "Ada",
                  "lastName": "Lovelace",
                  "phone": "+1 555 000 0000",
                  "sex": "%s",
                  "homeCountry": "FR",
                  "currentCity": "Paris",
                  "currentCountry": "FR"
                }
                """.formatted(email, sex);
    }

    private static String loginJson(String email, String password) {
        return "{\"email\": \"%s\", \"password\": \"%s\"}".formatted(email, password);
    }
}
