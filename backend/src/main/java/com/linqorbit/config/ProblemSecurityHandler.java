package com.linqorbit.config;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;

import tools.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Réponses de sécurité au format ProblemDetail (RFC 7807), dans le même esprit que
 * {@link com.linqorbit.common.exception.GlobalExceptionHandler} : un détail sûr,
 * construit ici, jamais le message brut d'une exception (les refus sont déjà logués
 * en WARN avec l'URI par le RequestLoggingFilter).
 *
 * <p>Le corps est écrit directement (pas de {@code sendError}) pour éviter le dispatch
 * vers {@code /error} et garder un format de réponse stable.
 */
public class ProblemSecurityHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    /** Jeton absent/invalide ou session expirée. */
    static final String UNAUTHORIZED_DETAIL = "Your session has expired. Please sign in again.";
    /** Authentifié mais rôle insuffisant. */
    static final String FORBIDDEN_DETAIL = "You do not have permission to perform this action.";

    private final ObjectMapper objectMapper;

    public ProblemSecurityHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        write(response, HttpStatus.UNAUTHORIZED, "Unauthorized", UNAUTHORIZED_DETAIL);
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        write(response, HttpStatus.FORBIDDEN, "Forbidden", FORBIDDEN_DETAIL);
    }

    private void write(HttpServletResponse response, HttpStatus status, String title, String detail)
            throws IOException {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(title);
        problem.setDetail(detail);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), problem);
    }
}
