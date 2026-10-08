package com.linqorbit.common.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.http.client.MockClientHttpResponse;

/**
 * Le contrat : l'interceptor pose le {@code X-Request-Id} du MDC sur l'appel
 * sortant, et n'envoie rien quand il n'y en a pas. Les noms littéraux sont
 * volontaires — c'est ce que l'autre bout (service IA) observe sur le fil.
 */
class CorrelationIdInterceptorTest {

    private final CorrelationIdInterceptor interceptor = new CorrelationIdInterceptor();
    private MockClientHttpRequest request;

    @BeforeEach
    void setUp() {
        MDC.clear();
        request = new MockClientHttpRequest(HttpMethod.POST, URI.create("http://ai.test/cv/parse"));
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    private ClientHttpResponse execute() throws IOException {
        ClientHttpRequestExecution execution =
                (req, body) -> new MockClientHttpResponse(new byte[0], HttpStatus.OK);
        return interceptor.intercept(request, new byte[0], execution);
    }

    @Test
    void interceptAjouteLenRequestIdDepuisLeMdc() throws IOException {
        MDC.put("correlationId", "req-42");

        ClientHttpResponse response = execute();

        assertThat(request.getHeaders().getFirst("X-Request-Id")).isEqualTo("req-42");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void interceptSansMdcNEnvoieAucunEnTete() throws IOException {
        ClientHttpResponse response = execute();

        assertThat(request.getHeaders().getFirst("X-Request-Id")).isNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void interceptIgnoreUneValeurVideDuMdc() throws IOException {
        MDC.put("correlationId", "   ");

        execute();

        assertThat(request.getHeaders().getFirst("X-Request-Id")).isNull();
    }
}
