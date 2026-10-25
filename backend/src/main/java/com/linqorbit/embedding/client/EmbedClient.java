package com.linqorbit.embedding.client;

import java.util.List;

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
import com.linqorbit.embedding.dto.EmbedRequest;
import com.linqorbit.embedding.dto.EmbedResponse;

import tools.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Appel du service IA (FastAPI, POST /embed) : envoie des textes déjà rendus
 * par {@code ProfileTextRenderer} et renvoie un vecteur par texte. Le backend
 * n'appelle jamais le fournisseur d'embeddings directement (D55). Traduit les
 * erreurs du service en {@link AiServiceException} portant le bon statut HTTP
 * (le 429 de quota est conservé : le worker diffère alors son retry).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmbedClient {

    private final RestClient aiRestClient;
    private final ObjectMapper objectMapper;

    public EmbedResponse embed(List<String> texts) {
        try {
            EmbedResponse response = aiRestClient.post()
                    .uri("/embed")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new EmbedRequest(texts))
                    .retrieve()
                    .body(EmbedResponse.class);
            if (response == null || response.embeddings() == null) {
                throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                        "The AI service returned an empty response.");
            }
            return response;
        } catch (HttpClientErrorException ex) {
            throw new AiServiceException(AiClientErrors.mapClientError(ex.getStatusCode()),
                    AiClientErrors.extractDetail(objectMapper, ex, "The embedding could not be generated."));
        } catch (HttpServerErrorException ex) {
            log.warn("AI service answered {} on /embed", ex.getStatusCode());
            throw new AiServiceException(HttpStatus.BAD_GATEWAY,
                    "The AI service failed to generate the embedding.");
        } catch (ResourceAccessException ex) {
            log.warn("AI service unreachable : {}", ex.getMessage());
            throw new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable.");
        } catch (RestClientException ex) {
            log.error("AI service call failed", ex);
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed.");
        }
    }
}
