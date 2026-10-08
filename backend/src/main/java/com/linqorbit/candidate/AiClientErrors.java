package com.linqorbit.candidate;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpStatusCodeException;

import com.linqorbit.candidate.exception.AiServiceException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * Mapping partagé des réponses d'erreur du service IA vers le bon statut et
 * le bon détail ({@link AiServiceException}). Sert {@link CvParseClient} et
 * {@link ProfileNormalizeClient} : aucune logique copiée d'un client à l'autre.
 */
@Slf4j
final class AiClientErrors {

    private AiClientErrors() {
    }

    /** 4xx du service IA (400 illisible, 422 sans texte, 429 quota…) telles quelles. */
    static HttpStatus mapClientError(HttpStatusCode statusCode) {
        HttpStatus resolved = HttpStatus.resolve(statusCode.value());
        if (resolved != null && resolved.is4xxClientError()) {
            return resolved;
        }
        return HttpStatus.BAD_REQUEST;
    }

    /** Le service IA répond {"detail": "..."} (FastAPI) ; fallback sinon. */
    static String extractDetail(ObjectMapper objectMapper, HttpStatusCodeException ex, String fallback) {
        try {
            JsonNode detail = objectMapper.readTree(ex.getResponseBodyAsString()).path("detail");
            if (detail.isTextual()) {
                return detail.asText();
            }
        } catch (Exception parseError) {
            log.debug("No JSON detail in the AI service error body");
        }
        if (ex.getStatusCode().value() == 429) {
            return "The AI service rate limit has been reached. Try again later.";
        }
        return fallback;
    }
}
