package com.linqorbit.common.logging;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Log des requêtes HTTP : corrélation (X-Request-Id / MDC), durée et statut de sortie.
 * Le corps des requêtes n'est jamais loggé (mots de passe, jetons) — les données
 * métier sont loggées par les services, champ par champ.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestLoggingFilter.class);

    static final String CORRELATION_ID = "correlationId";
    static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String correlationId = request.getHeader(REQUEST_ID_HEADER);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        MDC.put(CORRELATION_ID, correlationId);
        response.setHeader(REQUEST_ID_HEADER, correlationId);

        String target = request.getRequestURI();
        String query = request.getQueryString();
        if (query != null && !query.isBlank()) {
            target = target + "?" + query;
        }
        long start = System.nanoTime();
        try {
            LOGGER.info("-> {} {}", request.getMethod(), target);
            filterChain.doFilter(request, response);
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            int status = response.getStatus();
            if (status >= 500) {
                LOGGER.error("<- {} {} -> {} ({} ms)", request.getMethod(), target, status, durationMs);
            } else if (status >= 400) {
                LOGGER.warn("<- {} {} -> {} ({} ms)", request.getMethod(), target, status, durationMs);
            } else {
                LOGGER.info("<- {} {} -> {} ({} ms)", request.getMethod(), target, status, durationMs);
            }
        } finally {
            MDC.remove(CORRELATION_ID);
        }
    }
}
