package com.linqorbit.admin;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
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
 * Liste des comptes admin — filtres (T-48) de bout en bout : recherche
 * prénom / nom / email (LIKE insensible à la casse), statut (active |
 * inactive), capacité (candidate | recruiter — identité de profil, jamais un
 * rôle) et rejets 400 des filtres non supportés. Chaque assertion est bornée
 * par {@code q} sur des comptes créés par le test (la base locale contient
 * d'autres données) — sauf {@link #listeSansFiltres()}, qui couvre l'appel
 * par défaut de la console (aucun paramètre : le motif LIKE est null et le
 * SQL ne doit produire aucune ambiguïté de typage PostgreSQL).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AdminUsersIntegrationTest {

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
            jdbcTemplate.update("DELETE FROM candidates WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM recruiters WHERE id = ?", userId);
            jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", userId);
        }
        createdUserIds.clear();
    }

    @Test
    void listeSansFiltres() throws Exception {
        // Régression : aucun paramètre → motif LIKE null — l'ancien CONCAT('%', :q, '%')
        // faisait résoudre le paramètre non typé en bytea par PostgreSQL (500, lower(bytea)).
        mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.items[0].email").isNotEmpty());
    }

    @Test
    void rechercheParEmailEtParNomInsensibleALaCasse() throws Exception {
        String suffix = uniqueSuffix();
        String lastName = "Zfiltrable-" + suffix;
        SeededUser user = signup("search-" + suffix, "Ada", lastName);
        String adminToken = adminToken();

        // Email : le suffixe n'existe que dans l'email, pas dans le nom.
        mockMvc.perform(get("/api/v1/admin/users").param("q", suffix.toUpperCase())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(user.id().toString()));

        // Nom : la casse de la requête n'a pas d'incidence.
        mockMvc.perform(get("/api/v1/admin/users").param("q", lastName.toLowerCase())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].email").value(user.email()));
    }

    @Test
    void filtreParStatut() throws Exception {
        String suffix = uniqueSuffix();
        SeededUser user = signup("inactive-" + suffix, "Ivan", "Zstatut-" + suffix);
        jdbcTemplate.update("UPDATE users SET status = 2 WHERE id = ?", user.id());
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", suffix).param("status", "inactive")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].status").value("INACTIVE"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", suffix).param("status", "active")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void filtreParCapacite() throws Exception {
        String candidateSuffix = uniqueSuffix();
        SeededUser candidate = signup("candidate-" + candidateSuffix, "Camille", "Zcapacite-" + candidateSuffix);
        jdbcTemplate.update("INSERT INTO candidates (id, created_at, updated_at) VALUES (?, now(), now())",
                candidate.id());

        String recruiterSuffix = uniqueSuffix();
        SeededUser recruiter = signup("recruiter-" + recruiterSuffix, "Remy", "Zcapacite-" + recruiterSuffix);
        mockMvc.perform(post("/api/v1/recruiters/me").header("Authorization", "Bearer " + recruiter.token()))
                .andExpect(status().isCreated());

        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", candidateSuffix).param("capability", "candidate")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].hasCandidateProfile").value(true));

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", candidateSuffix).param("capability", "recruiter")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", recruiterSuffix).param("capability", "recruiter")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].hasRecruiterProfile").value(true));

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", recruiterSuffix).param("capability", "candidate")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void filtresNonSupportesRenvoient400() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users").param("status", "suspended")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unsupported status"));

        mockMvc.perform(get("/api/v1/admin/users").param("capability", "admin")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unsupported capability filter"));
    }

    /**
     * Paramètres présents mais vides (recherche effacée, filtres vidés) ≡
     * absents : même page, même taille, même total que l'appel nu — le front
     * envoie ces clés vides, la normalisation service les ramène à null.
     */
    @Test
    void parametresVidesEquivalentAbsents() throws Exception {
        String adminToken = adminToken();

        MvcResult unfiltered = mockMvc.perform(get("/api/v1/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        int total = objectMapper.readTree(unfiltered.getResponse().getContentAsString())
                .get("total").asInt();

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", "").param("status", "").param("capability", "")
                        .param("page", "").param("size", "")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(total));
    }

    @Test
    void filtresEnMajusculesAcceptes() throws Exception {
        String suffix = uniqueSuffix();
        SeededUser user = signup("uppercase-" + suffix, "Ursula", "Zmajuscule-" + suffix);
        jdbcTemplate.update("INSERT INTO candidates (id, created_at, updated_at) VALUES (?, now(), now())",
                user.id());
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users")
                        .param("q", suffix.toUpperCase()).param("status", "ACTIVE").param("capability", "CANDIDATE")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(user.id().toString()));
    }

    @Test
    void bornesDePagination() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users").param("size", "500")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(50));

        mockMvc.perform(get("/api/v1/admin/users").param("size", "0")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.items.length()").value(1));

        mockMvc.perform(get("/api/v1/admin/users").param("size", "-5")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1));

        mockMvc.perform(get("/api/v1/admin/users").param("page", "-3")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));

        mockMvc.perform(get("/api/v1/admin/users").param("page", "9999")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(9999))
                .andExpect(jsonPath("$.total").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.items").isEmpty());
    }

    /**
     * Paramètres non numériques : entrée client invalide, pas une panne —
     * 400 générique (régression : MethodArgumentTypeMismatchException tombait
     * dans le catch-all en 500 sous Boot 4).
     */
    @Test
    void parametresNonNumeriquesRenvoient400() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/v1/admin/users").param("page", "abc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value("The request could not be processed."));

        mockMvc.perform(get("/api/v1/admin/users").param("size", "abc")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Bad Request"));
    }

    /** Compte créé par le test : identité + jeton initial (sans rôle ADMIN). */
    private record SeededUser(UUID id, String email, String token) {
    }

    private String uniqueSuffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private SeededUser signup(String prefix, String firstName, String lastName) throws Exception {
        String email = prefix + "@example.com";
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "secret123",
                                  "firstName": "%s",
                                  "lastName": "%s",
                                  "phone": "+1 555 000 0000",
                                  "sex": "female",
                                  "homeCountry": "FR",
                                  "currentCity": "Paris",
                                  "currentCountry": "FR"
                                }
                                """.formatted(email, firstName, lastName)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        UUID id = UUID.fromString(body.get("user").get("id").asText());
        createdUserIds.add(id);
        return new SeededUser(id, email, body.get("token").asText());
    }

    /**
     * Jeton ADMIN : le rôle est inséré après le signup, donc un nouveau login
     * est nécessaire pour que le claim {@code roles} le porte.
     */
    private String adminToken() throws Exception {
        String suffix = uniqueSuffix();
        SeededUser admin = signup("admin-it-" + suffix, "Admin", "Zadmin-" + suffix);
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role) VALUES (?, 1)", admin.id());

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "secret123"}
                                """.formatted(admin.email())))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString())
                .get("token").asText();
    }
}
