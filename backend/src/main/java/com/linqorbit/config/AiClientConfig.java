package com.linqorbit.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Client HTTP vers le service IA (FastAPI, port 9082). Timeouts explicites :
 * sans eux, une réponse LLM suspendue bloquerait un thread HTTP indéfiniment.
 */
@Configuration
public class AiClientConfig {

    @Bean
    RestClient aiRestClient(@Value("${app.ai.base-url}") String baseUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        // A generous read timeout: an LLM call can legitimately take a while.
        requestFactory.setReadTimeout(Duration.ofSeconds(120));
        return RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }
}
