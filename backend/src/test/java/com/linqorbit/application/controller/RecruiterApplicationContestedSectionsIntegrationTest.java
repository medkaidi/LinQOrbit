package com.linqorbit.application.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Sections contestées de la carte de la liste recruteur, sur PostgreSQL réel :
 * répartition par section dans l'ordre d'affichage, plusieurs critères dans
 * une même section, absence de contestation ou d'évaluation, critère devenu
 * introuvable. La somme par section reste égale au compteur global.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecruiterApplicationContestedSectionsIntegrationTest extends RecruiterApplicationTestSupport {

    /** Deux critères dans les compétences obligatoires, un dans chacune des autres sections. */
    private static final String RESULT_WITH_TWO_REQUIRED = """
            {"sections":[
              {"section":"required_skills","score":60,"criteria":[
                {"key":"skill:java","label":"Java","requirement":"Strong Java","weight":4,"score":60,
                 "rationale":"Java rationale"},
                {"key":"skill:sql","label":"SQL","requirement":"SQL","weight":2,"score":50,
                 "rationale":"SQL rationale"}]},
              {"section":"preferred_skills","score":70,"criteria":[
                {"key":"skill:kotlin","label":"Kotlin","requirement":null,"weight":1,"score":70,
                 "rationale":"Kotlin is a plus"}]},
              {"section":"languages","score":80,"criteria":[
                {"key":"language:english","label":"English","requirement":"C1","weight":2,"score":80,
                 "rationale":"English is required"}]},
              {"section":"experience","score":85,"criteria":[
                {"key":"experience:years","label":"Years of experience","requirement":"5 years","weight":3,
                 "score":85,"rationale":"Experience matches"}]},
              {"section":"education","score":90,"criteria":[
                {"key":"education:requirement","label":"Education","requirement":"Master","weight":2,
                 "score":90,"rationale":"Education matches"}]}
            ]}""";

    private UUID publishedOffer(Owner owner) throws Exception {
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        return offerId;
    }

    private ResultActions list(Owner owner, UUID offerId) throws Exception {
        return mockMvc.perform(get(OFFERS_PATH + "/" + offerId + "/applications")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());
    }

    @Test
    void theCardListsTheContestedSectionsInDisplayOrderWithTheirCriteriaCount() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account grace = signup("Grace", "Hopper");
        // Saisie volontairement dans le désordre : l'ordre de sortie est celui des sections.
        draftAndMatch(grace, uploadCv(grace.token()), publicIdOf(offerId), RESULT_WITH_TWO_REQUIRED,
                List.of(feedback("education:requirement", 100, "Mine is a Master"),
                        feedback("skill:sql", 90, "I use SQL daily"),
                        feedback("skill:java", 80, "Java is my main language"),
                        feedback("language:english", 95, null)),
                null);

        list(owner, offerId)
                .andExpect(jsonPath("$.items[0].contestedCount").value(4))
                .andExpect(jsonPath("$.items[0].contestedSections.length()").value(3))
                .andExpect(jsonPath("$.items[0].contestedSections[0].section").value("requiredSkills"))
                // Deux critères d'une même section = un seul élément, compté deux fois.
                .andExpect(jsonPath("$.items[0].contestedSections[0].count").value(2))
                .andExpect(jsonPath("$.items[0].contestedSections[1].section").value("languages"))
                .andExpect(jsonPath("$.items[0].contestedSections[1].count").value(1))
                .andExpect(jsonPath("$.items[0].contestedSections[2].section").value("education"))
                .andExpect(jsonPath("$.items[0].contestedSections[2].count").value(1))
                // Les scores de section restent exactement ceux du résultat.
                .andExpect(jsonPath("$.items[0].sections.length()").value(5))
                .andExpect(jsonPath("$.items[0].sections[0].section").value("requiredSkills"))
                .andExpect(jsonPath("$.items[0].sections[0].score").value(60.0));
    }

    @Test
    void anAssessedApplicationWithoutContestHasNoContestedSection() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account grace = signup("Grace", "Hopper");
        draftAndMatch(grace, uploadCv(grace.token()), publicIdOf(offerId), RESULT_WITH_TWO_REQUIRED, List.of(),
                null);

        list(owner, offerId)
                .andExpect(jsonPath("$.items[0].contestedCount").value(0))
                .andExpect(jsonPath("$.items[0].contestedSections.length()").value(0));
    }

    @Test
    void aDirectApplicationWithoutAssessmentHasNoContestedSection() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account grace = signup("Grace", "Hopper");
        submitDirect(grace, uploadCv(grace.token()), publicIdOf(offerId));

        list(owner, offerId)
                .andExpect(jsonPath("$.items[0].assessmentAvailable").value(false))
                .andExpect(jsonPath("$.items[0].contestedCount").value(0))
                .andExpect(jsonPath("$.items[0].contestedSections.length()").value(0));
    }

    @Test
    void aCriterionMissingFromTheResultIsExcludedFromTheCounterAndFromTheSections() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = publishedOffer(owner);
        Account grace = signup("Grace", "Hopper");
        draftAndMatch(grace, uploadCv(grace.token()), publicIdOf(offerId), RESULT_WITH_TWO_REQUIRED,
                List.of(feedback("skill:java", 80, null), feedback("skill:ghost", 10, "Not in the result")),
                null);

        // La somme par section reste égale au compteur : le critère fantôme n'est dans aucun des deux.
        list(owner, offerId)
                .andExpect(jsonPath("$.items[0].contestedCount").value(1))
                .andExpect(jsonPath("$.items[0].contestedSections.length()").value(1))
                .andExpect(jsonPath("$.items[0].contestedSections[0].section").value("requiredSkills"))
                .andExpect(jsonPath("$.items[0].contestedSections[0].count").value(1));
    }
}
