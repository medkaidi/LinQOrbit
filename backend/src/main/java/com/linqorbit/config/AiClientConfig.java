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
 *
 * <p><b>Sémantique et limites des timeouts</b> : le connect timeout borne la
 * connexion TCP, le read timeout borne l'attente de données sur la socket
 * ({@code SO_TIMEOUT}). Quand il expire, le client lève une
 * {@code ResourceAccessException} et <b>libère son thread</b> : c'est la seule
 * protection du backend. Il n'existe <b>pas d'annulation côté serveur</b> —
 * FastAPI/le fournisseur LLM continue de calculer jusqu'au bout, la réponse
 * tardive arrive sur une socket fermée et est perdue (corrélation
 * {@code X-Request-Id} = jobId pour en retrouver la trace dans les logs IA).
 * En cas d'échec de connexion ou d'absence totale de réponse, c'est le cas
 * général d'une socket morte : même comportement. Un appel légitimement plus
 * lent que le read timeout est donc coupé côté client puis réessayé (retries
 * du job).</p>
 */
@Configuration
public class AiClientConfig {

    @Bean
    RestClient aiRestClient(@Value("${app.ai.base-url}") String baseUrl,
            @Value("${app.ai.connect-timeout-ms}") long connectTimeoutMs,
            @Value("${app.ai.read-timeout-ms}") long readTimeoutMs) {
        return aiRestClientBuilder(baseUrl, Duration.ofMillis(connectTimeoutMs),
                Duration.ofMillis(readTimeoutMs)).build();
    }

    /**
     * Builder partagé par le bean et les tests : c'est ici que l'interceptor
     * de corrélation est branché (wiring vérifié par {@code AiClientConfigTest}).
     */
    RestClient.Builder aiRestClientBuilder(String baseUrl, Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .requestInterceptor(new CorrelationIdInterceptor());
    }
}
