package com.linqorbit.joboffer.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Vocabulaires d'offre seedés en V12 (D14) : listes complètes, en lecture seule.
 * Publics depuis D100/T-113 (le board public `/public/jobs` doit proposer les
 * mêmes filtres que le board authentifié, sans compte) ; le reste de la racine
 * `job-offers` reste authentifié (TD-037).
 */
@SpringBootTest
@AutoConfigureMockMvc
class JobOfferReferenceIntegrationTest {

    private static final String REFERENCE_PATH = "/api/v1/job-offers/reference";

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
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    void contractTypesRenvoieLeVocabulaireSeedé() throws Exception {
        String token = signup();

        MvcResult result = mockMvc.perform(get(REFERENCE_PATH + "/contract-types")
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].label").isNotEmpty())
                .andExpect(jsonPath("$[0].id").isNotEmpty())
                .andReturn();

        List<String> labels = labels(result);
        assertThat(labels).containsExactlyInAnyOrder("Permanent", "Fixed-term", "Freelance",
                "Internship", "Apprenticeship", "Volunteer");
    }

    @Test
    void employmentTypesRenvoieFullEtPartTime() throws Exception {
        String token = signup();

        MvcResult result = mockMvc.perform(get(REFERENCE_PATH + "/employment-types")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn();

        assertThat(labels(result)).containsExactlyInAnyOrder("Full-time", "Part-time");
    }

    @Test
    void workModesRenvoieRemoteHybridOnSite() throws Exception {
        String token = signup();

        MvcResult result = mockMvc.perform(get(REFERENCE_PATH + "/work-modes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andReturn();

        assertThat(labels(result)).containsExactlyInAnyOrder("Remote", "Hybrid", "On-site");
    }

    @Test
    void referencesSontLisiblesSansJeton() throws Exception {
        // D100/T-113 : le board public doit proposer les mêmes filtres que le
        // board authentifié — le vocabulaire est une liste fermée, déjà visible
        // dans chaque offre publique.
        MvcResult result = mockMvc.perform(get(REFERENCE_PATH + "/work-modes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andReturn();

        assertThat(labels(result)).containsExactlyInAnyOrder("Remote", "Hybrid", "On-site");
    }

    @Test
    void leResteDeLaRacineJobOffersResteAuthentifie() throws Exception {
        // La publicsation ne porte que sur `reference/**` : la racine
        // `job-offers` reste protégée (TD-037).
        mockMvc.perform(get("/api/v1/job-offers"))
                .andExpect(status().isUnauthorized());
    }

    private List<String> labels(MvcResult result) throws Exception {
        JsonNode array = objectMapper.readTree(result.getResponse().getContentAsString());
        List<String> labels = new ArrayList<>();
        array.forEach(node -> labels.add(node.get("label").asText()));
        return labels;
    }

    private String signup() throws Exception {
        String email = "reference-" + UUID.randomUUID() + "@example.com";
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
