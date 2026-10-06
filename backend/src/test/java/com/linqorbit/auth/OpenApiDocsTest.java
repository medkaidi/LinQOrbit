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
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/diplomas'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/skills'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/languages'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/links'].put").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/me/profile/skill-suggestions'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/skills'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/languages'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/degrees'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/candidates/reference/study-fields'].get").exists());
    }

    @Test
    void exposeSwaggerUi() throws Exception {
        MvcResult result = mockMvc.perform(get("/swagger-ui.html")).andReturn();
        assertThat(result.getResponse().getStatus()).isBetween(200, 399);
    }
}
