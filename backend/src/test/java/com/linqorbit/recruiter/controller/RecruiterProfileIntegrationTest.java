package com.linqorbit.recruiter.controller;

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Parcours d'onboarding recruteur (D10/D16) de bout en bout : 404 sur GET /me
 * → création explicite → /auth/me signale isRecruiter → 409 au rejeu.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecruiterProfileIntegrationTest {

    private static final String ME_PATH = "/api/v1/recruiters/me";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    void onboardingRecruteurDe404AProfilCreeEtSignale() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);

        mockMvc.perform(get(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail")
                        .value("This account does not have a recruiter profile yet."));

        mockMvc.perform(post(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(userId.toString()))
                .andExpect(jsonPath("$.headline").doesNotExist());

        mockMvc.perform(get(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(userId.toString()));

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isRecruiter").value(true));

        mockMvc.perform(post(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM recruiters WHERE id = ?", Integer.class, userId))
                .isEqualTo(1);
    }

    @Test
    void updateHeadlineEtBioPuisEffacementParChaineVide() throws Exception {
        String token = signup();
        UUID userId = createdUserIds.get(createdUserIds.size() - 1);
        mockMvc.perform(post(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());

        mockMvc.perform(put(ME_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headline\": \"  Talent Acquisition Lead  \", \"bio\": \"Tech recruiting\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headline").value("Talent Acquisition Lead"))
                .andExpect(jsonPath("$.bio").value("Tech recruiting"));

        mockMvc.perform(put(ME_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"headline\": \"\", \"bio\": null}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headline").doesNotExist())
                .andExpect(jsonPath("$.bio").value("Tech recruiting"));

        mockMvc.perform(put(ME_PATH)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\": \"\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(ME_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headline").doesNotExist())
                .andExpect(jsonPath("$.bio").doesNotExist());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT headline FROM recruiters WHERE id = ?", String.class, userId))
                .isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT bio FROM recruiters WHERE id = ?", String.class, userId))
                .isNull();
    }

    private String signup() throws Exception {
        String email = "recruiter-" + UUID.randomUUID() + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "Ada",
                                  "lastName": "Lovelace",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        createdUserIds.add(UUID.fromString(body.get("user").get("id").asText()));
        return body.get("token").asText();
    }
}
