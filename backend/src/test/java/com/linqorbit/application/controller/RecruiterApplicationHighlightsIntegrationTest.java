package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

import tools.jackson.databind.JsonNode;

/**
 * Repères du candidat sur la carte de la liste recruteur (séniorité, années,
 * compétences) sur PostgreSQL réel : contenu de la liste blanche, repli
 * quand la fiche manque ou est partielle, absence de fuite, et chargement en
 * lot (le nombre de requêtes ne dépend pas du nombre de candidatures).
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecruiterApplicationHighlightsIntegrationTest extends RecruiterApplicationTestSupport {

    private static final String RICH_SHEET = """
            {"schemaVersion":"3","firstName":"Jeanne","lastName":"Secretan","email":"jeanne.secretan@example.com",
             "phone":"+33 6 99 88 77 66","title":"Senior Backend Engineer","seniority":"senior",
             "yearsOfExperience":9,"summary":"Led the payments platform at ACME-CORP",
             "location":{"city":"Lyon","country":"ES"},
             "skills":[
               {"name":"Java","category":"hard_skill","level":5,"yearsExperience":9},
               {"name":"Leadership","category":"soft_skill","level":5,"yearsExperience":9},
               {"name":"PostgreSQL","category":"hard_skill","level":4,"yearsExperience":7},
               {"name":"Kafka","category":"hard_skill","level":3},
               {"name":"Docker","category":"hard_skill","level":3},
               {"name":"Spring","category":"hard_skill","level":4,"yearsExperience":8},
               {"name":"Kubernetes","category":"hard_skill","level":2},
               {"name":"Terraform","category":"hard_skill","level":1},
               {"name":"Go","category":"hard_skill","level":2},
               {"name":"Rust","category":"hard_skill"}],
             "experiences":[{"positionTitle":"Tech Lead","companyName":"ACME-CORP"}],
             "links":[{"url":"https://github.com/jeannesecretan","linkType":"github"}]}""";

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private void sheet(UUID candidateId, int version, String content) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO normalized_profile
                    (normalized_profile_id, version, schema_version, content, validated_at, created_at, updated_at)
                VALUES (?, ?, '3', ?::jsonb, now(), now(), now())""", id, version, content);
        jdbcTemplate.update(
                "INSERT INTO normalized_profile_candidate (normalized_profile_id, candidate_id) VALUES (?, ?)",
                id, candidateId);
    }

    private String list(Owner owner, UUID offerId) throws Exception {
        return mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private UUID publishedOffer(Owner owner) throws Exception {
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        return offerId;
    }

    @Test
    void theCardCarriesSeniorityYearsAndTopSkillsAndLeaksNothingElse() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account jeanne = signup("Jeanne", "Secretan");
        submitDirect(jeanne, uploadCv(jeanne.token()), publicIdOf(offerId));
        sheet(jeanne.userId(), 1, RICH_SHEET);

        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].highlights.seniority").value("senior"))
                .andExpect(jsonPath("$.items[0].highlights.yearsOfExperience").value(9))
                // Le pays de la fiche prime sur celui déclaré à l'inscription (FR).
                .andExpect(jsonPath("$.items[0].highlights.country").value("ES"))
                // Hors soft skills, triés niveau puis années, plafonnés à 8.
                .andExpect(jsonPath("$.items[0].highlights.skills.length()").value(8))
                .andExpect(jsonPath("$.items[0].highlights.skills[0].name").value("Java"))
                .andExpect(jsonPath("$.items[0].highlights.skills[0].level").value(5))
                .andExpect(jsonPath("$.items[0].highlights.skills[1].name").value("Spring"))
                .andExpect(jsonPath("$.items[0].highlights.skills[2].name").value("PostgreSQL"));

        String highlights = objectMapper.readTree(list(owner, offerId)).get("items").get(0).get("highlights")
                .toString();
        assertThat(highlights).doesNotContain("Leadership", "jeanne.secretan@example.com", "+33", "Lyon",
                "ACME-CORP", "github", "Tech Lead", "Led the payments");
        assertThat(highlights).doesNotContain("\"email\"", "\"phone\"", "\"city\"", "\"location\"");
    }

    @Test
    void withoutASheetTheDeclaredYearsAreTheOnlyFallbackAndTheRestIsEmpty() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account declared = signup("Ada", "Declared");
        Account bare = signup("Bob", "Bare");
        submitDirect(declared, uploadCv(declared.token()), publicIdOf(offerId));
        submitDirect(bare, uploadCv(bare.token()), publicIdOf(offerId));
        jdbcTemplate.update("UPDATE candidates SET years_of_experience = 6 WHERE id = ?", declared.userId());
        jdbcTemplate.update("UPDATE candidates SET years_of_experience = NULL WHERE id = ?", bare.userId());
        jdbcTemplate.update("UPDATE users SET current_country = NULL WHERE id = ?", bare.userId());

        JsonNode items = objectMapper.readTree(list(owner, offerId)).get("items");
        JsonNode ada = highlightsOf(items, "Ada");
        JsonNode bob = highlightsOf(items, "Bob");
        assertThat(ada.get("yearsOfExperience").asInt()).isEqualTo(6);
        assertThat(ada.get("country").asString()).isEqualTo("FR");
        assertThat(ada.get("seniority").isNull()).isTrue();
        assertThat(ada.get("skills")).isEmpty();
        assertThat(bob.get("yearsOfExperience").isNull()).isTrue();
        assertThat(bob.get("country").isNull()).isTrue();
        assertThat(bob.get("seniority").isNull()).isTrue();
        assertThat(bob.get("skills")).isEmpty();
    }

    private static JsonNode highlightsOf(JsonNode items, String firstName) {
        for (JsonNode item : items) {
            if (firstName.equals(item.get("candidate").get("firstName").asString())) {
                return item.get("highlights");
            }
        }
        throw new AssertionError("No application for " + firstName);
    }

    @Test
    void theLatestSheetWinsAndItsYearsBeatTheDeclaredOnes() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account ada = signup("Ada", "Partial");
        submitDirect(ada, uploadCv(ada.token()), publicIdOf(offerId));
        jdbcTemplate.update("UPDATE candidates SET years_of_experience = 2 WHERE id = ?", ada.userId());
        sheet(ada.userId(), 1, "{\"schemaVersion\":\"3\",\"seniority\":\"junior\",\"yearsOfExperience\":1}");
        sheet(ada.userId(), 2, "{\"schemaVersion\":\"3\",\"seniority\":\"mid\",\"yearsOfExperience\":4}");

        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].highlights.seniority").value("mid"))
                .andExpect(jsonPath("$.items[0].highlights.yearsOfExperience").value(4))
                .andExpect(jsonPath("$.items[0].highlights.skills.length()").value(0));
    }

    @Test
    void aSheetWithoutALocationFallsBackOnTheDeclaredCountryAndNeverExposesTheCity() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account ada = signup("Ada", "Declared");
        Account bob = signup("Bob", "Blank");
        submitDirect(ada, uploadCv(ada.token()), publicIdOf(offerId));
        submitDirect(bob, uploadCv(bob.token()), publicIdOf(offerId));
        jdbcTemplate.update("UPDATE users SET current_country = 'DE', current_city = 'Berlin' WHERE id = ?",
                ada.userId());
        jdbcTemplate.update("UPDATE users SET current_country = '  ' WHERE id = ?", bob.userId());
        sheet(ada.userId(), 1, "{\"schemaVersion\":\"3\",\"seniority\":\"senior\"}");
        sheet(bob.userId(), 1, "{\"schemaVersion\":\"3\",\"location\":{\"city\":\"Lyon\"}}");

        String body = list(owner, offerId);
        JsonNode items = objectMapper.readTree(body).get("items");
        assertThat(highlightsOf(items, "Ada").get("country").asString()).isEqualTo("DE");
        assertThat(highlightsOf(items, "Bob").get("country").isNull()).isTrue();
        assertThat(body).doesNotContain("Berlin", "Lyon");
    }

    @Test
    void aSheetWithoutYearsFallsBackOnTheDeclaredOnes() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account ada = signup("Ada", "NoYears");
        submitDirect(ada, uploadCv(ada.token()), publicIdOf(offerId));
        jdbcTemplate.update("UPDATE candidates SET years_of_experience = 5 WHERE id = ?", ada.userId());
        sheet(ada.userId(), 1, "{\"schemaVersion\":\"3\",\"seniority\":\"senior\"}");

        mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].highlights.seniority").value("senior"))
                .andExpect(jsonPath("$.items[0].highlights.yearsOfExperience").value(5));
    }

    @Test
    void theHighlightsAreLoadedInBatchSoTheQueryCountDoesNotGrowWithTheApplications() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        String publicId = publicIdOf(offerId);
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        try {
            for (int i = 0; i < 2; i++) {
                Account account = signup("Cand" + i, "Batch");
                submitDirect(account, uploadCv(account.token()), publicId);
                sheet(account.userId(), 1, RICH_SHEET);
            }
            list(owner, offerId); // échauffement
            long withTwo = queries(statistics, owner, offerId);

            for (int i = 2; i < 5; i++) {
                Account account = signup("Cand" + i, "Batch");
                submitDirect(account, uploadCv(account.token()), publicId);
                sheet(account.userId(), 1, RICH_SHEET);
            }
            long withFive = queries(statistics, owner, offerId);

            assertThat(withTwo).isPositive();
            assertThat(withFive).isEqualTo(withTwo);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private long queries(Statistics statistics, Owner owner, UUID offerId) throws Exception {
        statistics.clear();
        list(owner, offerId);
        return statistics.getPrepareStatementCount();
    }
}
