package com.linqorbit.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;

/**
 * Métadonnées OpenAPI générées par springdoc (Swagger UI : /swagger-ui.html).
 * Le schéma Bearer est déclaré pour le futur enregistrement JWT ; il n'est pas
 * encore appliqué globalement car les endpoints d'auth sont publics.
 */
@Configuration
public class OpenApiConfig {

    public static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI linqOrbitOpenApi() {
        SecurityScheme bearer = new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")
                .description("Jeton JWT émis par /api/v1/auth/login");
        return new OpenAPI()
                .info(new Info()
                        .title("LinQOrbit API")
                        .description("API de la plateforme de recrutement LinQOrbit")
                        .version("v1"))
                .components(new Components().addSecuritySchemes(BEARER_SCHEME, bearer));
    }
}
