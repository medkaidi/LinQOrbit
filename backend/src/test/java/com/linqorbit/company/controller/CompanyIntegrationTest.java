package com.linqorbit.company.controller;

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
 * Parcours company de bout en bout (D11–D12) : création owner, listage, lecture,
 * mise à jour owner ; non-membre = 404 (aucune fuite d'existence), membre non
 * owner (membership injecté en SQL, aucun endpoint d'invitation en V0) = 403.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CompanyIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<UUID> createdUserIds = new ArrayList<>();
    private final List<UUID> createdCompanyIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (UUID userId : createdUserIds) {
            jdbcTemplate.update("DELETE FROM company_members WHERE recruiter_id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        for (UUID companyId : createdCompanyIds) {
            jdbcTemplate.update("DELETE FROM companies WHERE id = ?", companyId);
        }
        createdUserIds.clear();
        createdCompanyIds.clear();
    }

    @Test
    void creationListeLectureEtMajOwner() throws Exception {
        String token = signup("owner");
        becomeRecruiter(token);
        UUID userId = lastUserId();

        mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"  Acme  \", \"description\": \"We build things\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme"))
                .andExpect(jsonPath("$.description").value("We build things"))
                .andExpect(jsonPath("$.isOwner").value(true));

        UUID companyId = companyIdOwnedBy(userId);
        createdCompanyIds.add(companyId);

        mockMvc.perform(get("/api/v1/companies").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(companyId.toString()))
                .andExpect(jsonPath("$[0].isOwner").value(true));

        mockMvc.perform(get("/api/v1/companies/" + companyId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(companyId.toString()));

        mockMvc.perform(put("/api/v1/companies/" + companyId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme Corp\", \"description\": \"\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/companies/" + companyId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Acme Corp"))
                .andExpect(jsonPath("$.description").doesNotExist());

        assertThat(jdbcTemplate.queryForObject(
                "SELECT is_owner FROM company_members WHERE company_id = ? AND recruiter_id = ?",
                Boolean.class, companyId, userId))
                .isTrue();
    }

    @Test
    void nonMembreRecoit404EtMembreNonOwner403() throws Exception {
        String ownerToken = signup("owner");
        becomeRecruiter(ownerToken);
        mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\"}"))
                .andExpect(status().isCreated());
        UUID companyId = companyIdOwnedBy(lastUserId());
        createdCompanyIds.add(companyId);

        String otherToken = signup("member");
        becomeRecruiter(otherToken);
        UUID otherId = lastUserId();

        mockMvc.perform(get("/api/v1/companies/" + companyId).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/companies/" + companyId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Hijacked\"}"))
                .andExpect(status().isNotFound());

        jdbcTemplate.update("INSERT INTO company_members (company_id, recruiter_id, is_owner) VALUES (?, ?, false)",
                companyId, otherId);

        mockMvc.perform(get("/api/v1/companies/" + companyId).header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(false));
        mockMvc.perform(put("/api/v1/companies/" + companyId)
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Hijacked\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void creationCompanySansProfilRecruteurRenvoie404() throws Exception {
        String token = signup("plain");

        mockMvc.perform(post("/api/v1/companies")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Acme\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("This account does not have a recruiter profile yet."));
    }

    private UUID companyIdOwnedBy(UUID recruiterId) {
        return jdbcTemplate.queryForObject(
                "SELECT company_id FROM company_members WHERE recruiter_id = ?", UUID.class, recruiterId);
    }

    private void becomeRecruiter(String token) throws Exception {
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
    }

    private UUID lastUserId() {
        return createdUserIds.get(createdUserIds.size() - 1);
    }

    private String signup(String prefix) throws Exception {
        String email = prefix + "-" + UUID.randomUUID() + "@example.com";
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
