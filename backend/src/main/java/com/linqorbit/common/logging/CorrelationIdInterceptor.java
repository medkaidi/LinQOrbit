package com.linqorbit.common.logging;

import java.io.IOException;

import org.slf4j.MDC;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

/**
 * Propagation de l'identifiant de corrélation vers les appels HTTP sortants :
 * le {@code X-Request-Id} posé en MDC par {@link RequestLoggingFilter} est
 * renvoyé en en-tête, si bien que les logs du service appelé (FastAPI) portent
 * le même identifiant et se corrigent avec ceux de cette requête.
 *
 * <p>Sans MDC (appel hors requête, ex. {@code CommandLineRunner}) : aucun
 * en-tête n'est envoyé — jamais de {@code X-Request-Id} vide ou nul.</p>
 *
 * <p>Fonctionne parce que les appels sont <strong>synchrone sur le thread de
 * la requête</strong> (le MDC est donc encore vivant à l'exécution de
 * l'interceptor). Si un appel sortant devient asynchrone, le thread-local
 * doit être propagé explicitement.</p>
 */
public class CorrelationIdInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body,
            ClientHttpRequestExecution execution) throws IOException {
        String correlationId = MDC.get(RequestLoggingFilter.CORRELATION_ID);
        if (correlationId != null && !correlationId.isBlank()) {
            request.getHeaders().set(RequestLoggingFilter.REQUEST_ID_HEADER, correlationId);
        }
        return execution.execute(request, body);
    }
}
