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
import com.linqorbit.matching.dto.MatchingAnalyzeRequest;

import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Appel du service IA (FastAPI, POST /matching/analyze) : envoie tout le
 * contexte du matching et renvoie l'analyse produite, telle quelle (JSON
 * camelCase). Miroir de {@code JobOfferNormalizeClient} : erreurs traduites en
 * {@link AiServiceException} portant le bon statut HTTP, en-tête
 * {@code X-Request-Id} propagé par l'interceptor de {@code aiRestClient}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingAnalyzeClient {

    private final RestClient aiRestClient;
    private final ObjectMapper objectMapper;

    public String analyze(MatchingAnalyzeRequest request) {
        try {
            String response = aiRestClient.post()
                    .uri("/matching/analyze")
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
                    AiClientErrors.extractDetail(objectMapper, ex, "The matching could not be analyzed."));
        } catch (HttpServerErrorException ex) {
            log.warn("AI service answered {} : {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service failed to analyze this matching.");
        } catch (ResourceAccessException ex) {
            log.warn("AI service unreachable : {}", ex.getMessage());
            throw new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable.");
        } catch (RestClientException ex) {
            log.error("AI service call failed", ex);
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed.");
        }
    }
}
