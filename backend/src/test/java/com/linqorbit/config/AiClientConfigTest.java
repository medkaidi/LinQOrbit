package com.linqorbit.config;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.Duration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Wiring : le builder du bean {@code aiRestClient} porte réellement
 * l'interceptor de corrélation — le seul test qui prouve que les appels
 * vers le service IA sortent avec le {@code X-Request-Id} du MDC.
 */
class AiClientConfigTest {

    private MockRestServiceServer server;
    private RestClient aiRestClient;

    @BeforeEach
    void setUp() {
        MDC.clear();
        RestClient.Builder builder = new AiClientConfig()
                .aiRestClientBuilder("http://ai.test", Duration.ofSeconds(5), Duration.ofSeconds(120));
        server = MockRestServiceServer.bindTo(builder).build();
        aiRestClient = builder.build();
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void aiRestClientPorteLenRequestIdDuMdcVersLeServiceIA() {
        MDC.put("correlationId", "smoke-req-1");
        server.expect(requestTo("http://ai.test/cv/parse"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Request-Id", "smoke-req-1"))
                .andRespond(withSuccess());

        aiRestClient.get().uri("/cv/parse").retrieve().toBodilessEntity();

        server.verify();
    }

    @Test
    void aiRestClientSansMdcNEnvoieAucunEnTete() {
        server.expect(requestTo("http://ai.test/cv/parse"))
                .andExpect(headerDoesNotExist("X-Request-Id"))
                .andRespond(withSuccess());

        aiRestClient.get().uri("/cv/parse").retrieve().toBodilessEntity();

        server.verify();
    }
}
