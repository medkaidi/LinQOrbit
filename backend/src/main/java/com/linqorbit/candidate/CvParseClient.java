package com.linqorbit.candidate;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.exception.AiServiceException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Appel du service IA (FastAPI, POST /cv/parse). Traduit les réponses et
 * erreurs du service en {@link AiServiceException} portant le bon statut HTTP.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CvParseClient {

    private final RestClient aiRestClient;
    private final ObjectMapper objectMapper;

    public CvParseResponse parse(MultipartFile file) {
        try {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv.pdf";
            // The content type must reach the AI service: it validates application/pdf.
            body.part("file", file.getBytes(), MediaType.parseMediaType(file.getContentType()))
                    .filename(filename);

            CvParseResponse response = aiRestClient.post()
                    .uri("/cv/parse")
                    .body(body.build())
                    .retrieve()
                    .body(CvParseResponse.class);
            if (response == null) {
                throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service returned an empty response.");
            }
            return response;
        } catch (HttpClientErrorException ex) {
            throw new AiServiceException(mapClientError(ex.getStatusCode()), extractDetail(ex));
        } catch (HttpServerErrorException ex) {
            log.warn("AI service answered {} : {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service failed to parse this CV.");
        } catch (ResourceAccessException ex) {
            log.warn("AI service unreachable : {}", ex.getMessage());
            throw new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "The AI service is unreachable.");
        } catch (RestClientException ex) {
            log.error("AI service call failed", ex);
            throw new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service call failed.");
        } catch (IOException ex) {
            throw new AiServiceException(HttpStatus.BAD_REQUEST, "The uploaded file could not be read.");
        }
    }

    /** 4xx du service IA (400 illisible, 422 sans texte, 429 quota…) telles quelles. */
    private HttpStatus mapClientError(org.springframework.http.HttpStatusCode statusCode) {
        HttpStatus resolved = HttpStatus.resolve(statusCode.value());
        if (resolved != null && resolved.is4xxClientError()) {
            return resolved;
        }
        return HttpStatus.BAD_REQUEST;
    }

    /** Le service IA répond {"detail": "..."} (FastAPI) ; fallback sinon. */
    private String extractDetail(HttpStatusCodeException ex) {
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
        return "The CV could not be parsed.";
    }
}
