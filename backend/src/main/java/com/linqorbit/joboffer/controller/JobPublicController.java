package com.linqorbit.joboffer.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.joboffer.dto.PublicJobListItem;
import com.linqorbit.joboffer.dto.PublicJobPageResponse;
import com.linqorbit.joboffer.dto.PublicJobResponse;
import com.linqorbit.joboffer.service.JobOfferService;

/**
 * Lecture publique (V15/T-72) — chemin distinct du management
 * {@code /job-offers/**} (authentifié) : {@code permitAll} côté sécurité.
 */
@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobPublicController implements JobPublicApi {

    private final JobOfferService jobOfferService;

    @Override
    public ResponseEntity<PublicJobPageResponse> listJobs(Integer page) {
        return ResponseEntity.ok(jobOfferService.listPublic(page));
    }

    @Override
    public ResponseEntity<PublicJobResponse> getJob(String publicId) {
        return ResponseEntity.ok(jobOfferService.getPublic(publicId));
    }

    @Override
    public ResponseEntity<List<PublicJobListItem>> listRelatedJobs(String publicId) {
        return ResponseEntity.ok(jobOfferService.listRelatedPublic(publicId));
    }
}
