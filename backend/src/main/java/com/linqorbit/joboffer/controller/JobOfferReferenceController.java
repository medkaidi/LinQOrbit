package com.linqorbit.joboffer.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.joboffer.dto.LabelOption;
import com.linqorbit.joboffer.service.JobOfferReferenceService;

@RestController
@RequestMapping("/api/v1/job-offers/reference")
@RequiredArgsConstructor
public class JobOfferReferenceController implements JobOfferReferenceApi {

    private final JobOfferReferenceService jobOfferReferenceService;

    @Override
    public ResponseEntity<List<LabelOption>> contractTypes(Authentication authentication) {
        return ResponseEntity.ok(jobOfferReferenceService.contractTypes());
    }

    @Override
    public ResponseEntity<List<LabelOption>> employmentTypes(Authentication authentication) {
        return ResponseEntity.ok(jobOfferReferenceService.employmentTypes());
    }

    @Override
    public ResponseEntity<List<LabelOption>> workModes(Authentication authentication) {
        return ResponseEntity.ok(jobOfferReferenceService.workModes());
    }
}
