package com.linqorbit.joboffer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.joboffer.dto.PublicJobResponse;
import com.linqorbit.joboffer.service.JobOfferService;

/**
 * Lecture publique d'une offre publiée (V15) — chemin distinct du management
 * {@code /job-offers/**} (authentifié) : {@code permitAll} côté sécurité.
 */
@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobPublicController implements JobPublicApi {

    private final JobOfferService jobOfferService;

    @Override
    public ResponseEntity<PublicJobResponse> getJob(String publicId) {
        return ResponseEntity.ok(jobOfferService.getPublic(publicId));
    }
}
