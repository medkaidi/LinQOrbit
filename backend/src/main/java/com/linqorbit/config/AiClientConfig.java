package com.linqorbit.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import com.linqorbit.common.logging.CorrelationIdInterceptor;

/**
 * Client HTTP vers le service IA (FastAPI, port 9082). Timeouts explicites :
 * sans eux, une réponse LLM suspendue bloquerait un thread HTTP indéfiniment.
 * Chaque appel sortant porte le {@code X-Request-Id} de la requête courante
 * ({@link CorrelationIdInterceptor}) : les logs du service IA se corrigent
 * avec ceux du backend sous le même identifiant.
 */
@Configuration
public class AiClientConfig {

    @Bean
    RestClient aiRestClient(@Value("${app.ai.base-url}") String baseUrl) {
        return aiRestClientBuilder(baseUrl).build();
    }

    /**
     * Builder partagé par le bean et les tests : c'est ici que l'interceptor
     * de corrélation est branché (wiring vérifié par {@code AiClientConfigTest}).
     */
    RestClient.Builder aiRestClientBuilder(String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        // A generous read timeout: an LLM call can legitimately take a while.
        requestFactory.setReadTimeout(Duration.ofSeconds(120));
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .requestInterceptor(new CorrelationIdInterceptor());
    }
}
