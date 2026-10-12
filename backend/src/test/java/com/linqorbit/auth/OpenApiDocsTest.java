package com.linqorbit.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiDocsTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsAuth() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("LinQOrbit API"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post.summary")
                        .value("Créer un compte"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.summary")
                        .value("Se connecter"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].get.summary")
                        .value("Profil du compte"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/me'].put.summary")
                        .value("Mettre à jour le profil du compte"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/change-password'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/change-password'].post.summary")
                        .value("Changer le mot de passe"));
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsDuProfilCandidat() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile'].get.summary")
                        .value("Lire le profil candidat"))
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/about'].put.summary")
                        .value("Mettre à jour la section À propos"))
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/about/target-position'].put.summary")
                        .value("Mettre à jour le poste recherché"))
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/experiences'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/projects'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/diplomas'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/skills'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/languages'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/links'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/validate'].post.summary")
                        .value("Valider le profil et lancer la normalisation"))
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/skill-suggestions'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/skills'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/languages'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/degrees'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/study-fields'].get").exists());
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsDAdministration() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/admin/users'].get.summary")
                        .value("Lister les comptes"))
                .andExpect(jsonPath("$.paths['/api/v1/admin/users/{userId}/status'].patch.summary")
                        .value("Activer ou désactiver un compte"))
                .andExpect(jsonPath("$.paths['/api/v1/admin/skill-suggestions'].get.summary")
                        .value("Lister les suggestions de compétences"))
                .andExpect(jsonPath("$.paths['/api/v1/admin/skill-suggestions/{id}/approve'].post.summary")
                        .value("Approuver une suggestion de compétence"))
                .andExpect(jsonPath("$.paths['/api/v1/admin/skill-suggestions/{id}/link'].post.summary")
                        .value("Relier une suggestion à une compétence existante"))
                .andExpect(jsonPath("$.paths['/api/v1/admin/skill-suggestions/{id}/reject'].post.summary")
                        .value("Rejeter une suggestion de compétence"));
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsRecruteur() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/recruiters/me'].post.summary")
                        .value("Activer le profil recruteur"))
                .andExpect(jsonPath("$.paths['/api/v1/recruiters/me'].get.summary")
                        .value("Lire le profil recruteur"))
                .andExpect(jsonPath("$.paths['/api/v1/recruiters/me'].put.summary")
                        .value("Mettre à jour le profil recruteur"));
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsCompany() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/companies'].post.summary")
                        .value("Créer une company"))
                .andExpect(jsonPath("$.paths['/api/v1/companies'].get.summary")
                        .value("Lister mes companies"))
                .andExpect(jsonPath("$.paths['/api/v1/companies/{companyId}'].get.summary")
                        .value("Lire une company"))
                .andExpect(jsonPath("$.paths['/api/v1/companies/{companyId}'].put.summary")
                        .value("Mettre à jour une company"));
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesReferencesDOffre() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/reference/contract-types'].get.summary")
                        .value("Lister les types de contrat"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/reference/employment-types'].get.summary")
                        .value("Lister les types d'emploi"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/reference/work-modes'].get.summary")
                        .value("Lister les modes de travail"));
    }

    @Test
    void exposeLeDocumentOpenApiAvecLesEndpointsOffre() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/job-offers'].post.summary")
                        .value("Créer une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers'].get.summary")
                        .value("Lister mes offres"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}'].get.summary")
                        .value("Lire une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}'].put.summary")
                        .value("Modifier une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}'].delete.summary")
                        .value("Supprimer une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}/duplicate'].post.summary")
                        .value("Dupliquer une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}/validate'].post.summary")
                        .value("Valider une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}/publish'].post.summary")
                        .value("Publier une offre"))
                .andExpect(jsonPath("$.paths['/api/v1/job-offers/{offerId}/close'].post.summary")
                        .value("Clôturer une offre"));
    }

    @Test
    void exposeSwaggerUi() throws Exception {
        MvcResult result = mockMvc.perform(get("/swagger-ui.html")).andReturn();
        assertThat(result.getResponse().getStatus()).isBetween(200, 399);
    }
}
