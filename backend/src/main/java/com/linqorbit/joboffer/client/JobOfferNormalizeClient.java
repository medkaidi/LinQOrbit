package com.linqorbit.joboffer.client;

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
import com.linqorbit.joboffer.dto.OfferNormalizeRequest;

import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Appel du service IA (FastAPI, POST /job-offer/normalize) : envoie le
 * snapshot de l'offre + le contexte de référence et renvoie l'objet
 * canonique produit, tel quel (JSON camelCase). Traduit les erreurs du
 * service en {@link AiServiceException} portant le bon statut HTTP.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JobOfferNormalizeClient {

    private final RestClient aiRestClient;
    private final ObjectMapper objectMapper;

    public String normalize(OfferNormalizeRequest request) {
        try {
            String response = aiRestClient.post()
                    .uri("/job-offer/normalize")
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
                    AiClientErrors.extractDetail(objectMapper, ex,
                            "The offer could not be normalized."));
        } catch (HttpServerErrorException ex) {
            log.warn("AI service answered {} : {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service failed to normalize this offer.");
        } catch (ResourceAccessException ex) {
            log.warn("AI service unreachable : {}", ex.getMessage());
            throw new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable.");
        } catch (RestClientException ex) {
            log.error("AI service call failed", ex);
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed.");
        }
    }
}
