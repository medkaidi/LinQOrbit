package com.linqorbit.candidate;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.exception.AiServiceException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Import de CV : contrôle du fichier puis délèguage au service IA.
 * Aucune écriture en base — le résultat est prévisualisé par le client.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CvParseService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";

    private final CvParseClient cvParseClient;

    public CvParseResponse parseCv(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AiServiceException(HttpStatus.BAD_REQUEST, "No file uploaded.");
        }
        if (!PDF_CONTENT_TYPE.equalsIgnoreCase(file.getContentType())) {
            throw new AiServiceException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported.");
        }
        log.info("Parsing CV [{}] through the AI service", file.getOriginalFilename());
        CvParseResponse response = cvParseClient.parse(file);
        log.info("CV parsed: {} experience(s), {} diploma(s), {} skill(s)",
                response.experiences().size(), response.diplomas().size(), response.skills().size());
        return response;
    }
}
