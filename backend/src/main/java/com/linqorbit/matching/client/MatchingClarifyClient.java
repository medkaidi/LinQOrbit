package com.linqorbit.matching.client;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.linqorbit.candidate.client.AiClientErrors;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.matching.dto.MatchingClarifyRequest;

import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Appel du service IA (FastAPI, POST /matching/clarify, T-62) : envoie tout
 * le contexte (fiches, critères, évaluations du tour, historique des
 * clarifications, budget restant) et renvoie la suggestion telle quelle
 * ({@code {"question": {...}}} ou {@code {"question": null}}). Miroir de
 * {@link MatchingAnalyzeClient} : mêmes erreurs, même {@code X-Request-Id}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingClarifyClient {

    private final RestClient aiRestClient;
    private final ObjectMapper objectMapper;

    public String clarify(MatchingClarifyRequest request) {
        try {
            String response = aiRestClient.post()
                    .uri("/matching/clarify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(String.class);
            if (response == null || response.isBlank()) {
                throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                        "The AI service returned an empty response.");
            }
            return response;
        } catch (HttpClientErrorException ex) {
            throw new AiServiceException(AiClientErrors.mapClientError(ex.getStatusCode()),
                    AiClientErrors.extractDetail(objectMapper, ex, "No clarification question could be prepared."));
        } catch (HttpServerErrorException ex) {
            log.warn("AI service answered {} : {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service failed to prepare a clarification question.");
        } catch (ResourceAccessException ex) {
            log.warn("AI service unreachable : {}", ex.getMessage());
            throw new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable.");
        } catch (RestClientException ex) {
            log.error("AI service call failed", ex);
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed.");
        }
    }
}
