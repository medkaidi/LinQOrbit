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
                        .value("Se connecter"));
    }

    @Test
    void exposeSwaggerUi() throws Exception {
        MvcResult result = mockMvc.perform(get("/swagger-ui.html")).andReturn();
        assertThat(result.getResponse().getStatus()).isBetween(200, 399);
    }
}
