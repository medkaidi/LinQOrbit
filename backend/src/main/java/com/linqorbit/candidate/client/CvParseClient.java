package com.linqorbit.candidate.client;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import tools.jackson.databind.ObjectMapper;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.ParseContext;
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

    public CvParseResponse parse(MultipartFile file, ParseContext context) {
        try {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "cv.pdf";
            // The content type must reach the AI service: it validates application/pdf.
            body.part("file", file.getBytes(), MediaType.parseMediaType(file.getContentType()))
                    .filename(filename);
            // Reference vocabulary as a JSON part (no filename -> plain form field).
            body.part("context", objectMapper.writeValueAsBytes(context), MediaType.APPLICATION_JSON);

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
            throw new AiServiceException(AiClientErrors.mapClientError(ex.getStatusCode()),
                    AiClientErrors.extractDetail(objectMapper, ex, "The CV could not be parsed."));
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
}
