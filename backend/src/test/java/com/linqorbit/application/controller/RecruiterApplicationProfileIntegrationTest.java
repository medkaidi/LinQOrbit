package com.linqorbit.application.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;

/**
 * Profil du candidat d'une candidature, vu par un recruteur (T-125, D107) sur
 * PostgreSQL réel : profil complet et coordonnées d'un candidat qui a
 * candidaté, sans condition de consentement ; mêmes droits et mêmes 404 sûrs
 * que le détail de la candidature (D12).
 */
@SpringBootTest
@AutoConfigureMockMvc
class RecruiterApplicationProfileIntegrationTest extends RecruiterApplicationTestSupport {

    private String profilePath(UUID offerId, UUID applicationId) {
        return OFFERS_PATH + "/" + offerId + "/applications/" + applicationId + "/profile";
    }

    /** Profil candidat enrichi (intitulé + bio) : la candidature exige un profil. */
    private void fillProfile(Account candidate) throws Exception {
        mockMvc.perform(put("/api/v1/candidates/me/profile/about")
                        .header("Authorization", "Bearer " + candidate.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Backend Engineer","bio":"Builds payment systems","yearsOfExperience":8,
                                 "searchStatus":"open_to_work"}"""))
                .andExpect(status().isNoContent());
    }

    @Test
    void theRecruiterReadsTheFullProfileAndTheContactDetailsOfAnApplicant() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account grace = signup("Grace", "Hopper");
        fillProfile(grace);
        UUID applicationId = submitDirect(grace, uploadCv(grace.token()), publicId);

        String body = mockMvc.perform(get(profilePath(offerId, applicationId))
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate.firstName").value("Grace"))
                .andExpect(jsonPath("$.candidate.lastName").value("Hopper"))
                .andExpect(jsonPath("$.candidate.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.email").value(emailOf(grace)))
                .andExpect(jsonPath("$.phone").value("+1 555 000 0000"))
                .andExpect(jsonPath("$.currentCity").value("Paris"))
                .andExpect(jsonPath("$.currentCountry").value("FR"))
                .andExpect(jsonPath("$.profile.about.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.profile.about.bio").value("Builds payment systems"))
                .andExpect(jsonPath("$.profile.experiences").isArray())
                .andExpect(jsonPath("$.profile.skills").isArray())
                .andReturn().getResponse().getContentAsString();

        // Le recruteur dispose du moyen de contacter le candidat : ses coordonnées
        // sont dans la réponse, jamais un « Not available ».
        assertThat(body).contains(emailOf(grace)).contains("+1 555 000 0000");
    }

    @Test
    void theProfileIsVisibleWithoutAnyRecruiterVisibilityConsent() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account alan = signup("Alan", "Turing");
        fillProfile(alan);
        UUID applicationId = submitDirect(alan, uploadCv(alan.token()), publicId);

        // Aucun consentement de visibilité recruteur : la candidature n'en dépend pas.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT recruiter_visibility_consent_at FROM candidates WHERE id = ?", Object.class,
                alan.userId())).isNull();

        mockMvc.perform(get(profilePath(offerId, applicationId))
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate.firstName").value("Alan"))
                .andExpect(jsonPath("$.email").value(emailOf(alan)))
                .andExpect(jsonPath("$.phone").value("+1 555 000 0000"));
    }

    @Test
    void anyMemberOfTheCompanyReadsTheProfile() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        Account member = memberOf(owner.companyId());
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account grace = signup("Grace", "Hopper");
        fillProfile(grace);
        UUID applicationId = submitDirect(grace, uploadCv(grace.token()), publicId);

        mockMvc.perform(get(profilePath(offerId, applicationId))
                        .header("Authorization", "Bearer " + member.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate.firstName").value("Grace"));
    }

    @Test
    void aRecruiterOutsideTheCompanyGetsTheSameNotFound() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account grace = signup("Grace", "Hopper");
        fillProfile(grace);
        UUID applicationId = submitDirect(grace, uploadCv(grace.token()), publicId);

        Account stranger = signupRecruiter("Stranger", "Outside");
        mockMvc.perform(get(profilePath(offerId, applicationId))
                        .header("Authorization", "Bearer " + stranger.token()))
                .andExpect(status().isNotFound());
    }

    @Test
    void aDraftOrWithdrawnApplicationHasNoProfileForTheRecruiter() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account edsger = signup("Edsger", "Dijkstra");
        fillProfile(edsger);
        uploadCv(edsger.token());
        UUID draftId = idOf(saveDraft(edsger.token(), publicId, "[]").andExpect(status().isOk()).andReturn());

        mockMvc.perform(get(profilePath(offerId, draftId))
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNotFound());

        Account barbara = signup("Barbara", "Liskov");
        fillProfile(barbara);
        UUID withdrawnId = submitDirect(barbara, uploadCv(barbara.token()), publicId);
        mockMvc.perform(post("/api/v1/applications/" + withdrawnId + "/withdraw")
                        .header("Authorization", "Bearer " + barbara.token()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get(profilePath(offerId, withdrawnId))
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isNotFound());
    }

    @Test
    void withoutATokenTheProfileIsUnauthorized() throws Exception {
        Owner owner = ownerWithCompany("Acme");
        UUID offerId = createOffer(owner.token(), owner.companyId(), "Backend Engineer", null);
        publish(owner.token(), offerId);
        String publicId = publicIdOf(offerId);

        Account grace = signup("Grace", "Hopper");
        fillProfile(grace);
        UUID applicationId = submitDirect(grace, uploadCv(grace.token()), publicId);

        mockMvc.perform(get(profilePath(offerId, applicationId)))
                .andExpect(status().isUnauthorized());
    }
}
