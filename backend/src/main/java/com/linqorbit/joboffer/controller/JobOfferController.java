package com.linqorbit.joboffer.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.service.JobOfferService;

@RestController
@RequestMapping("/api/v1/job-offers")
@RequiredArgsConstructor
public class JobOfferController implements JobOfferApi {

    private final JobOfferService jobOfferService;

    @Override
    public ResponseEntity<JobOfferResponse> create(CreateJobOfferRequest request, Authentication authentication) {
        return ResponseEntity.status(201)
                .body(jobOfferService.create(CurrentUserId.from(authentication), request));
    }

    @Override
    public ResponseEntity<List<JobOfferResponse>> listMine(Authentication authentication) {
        return ResponseEntity.ok(jobOfferService.listMine(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<JobOfferResponse> get(UUID offerId, Authentication authentication) {
        return ResponseEntity.ok(jobOfferService.get(CurrentUserId.from(authentication), offerId));
    }

    @Override
    public ResponseEntity<Void> update(UUID offerId, UpdateJobOfferRequest request, Authentication authentication) {
        jobOfferService.update(CurrentUserId.from(authentication), offerId, request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> delete(UUID offerId, Authentication authentication) {
        jobOfferService.delete(CurrentUserId.from(authentication), offerId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<JobOfferResponse> duplicate(UUID offerId, Authentication authentication) {
        return ResponseEntity.status(201)
                .body(jobOfferService.duplicate(CurrentUserId.from(authentication), offerId));
    }

    @Override
    public ResponseEntity<Void> validate(UUID offerId, Authentication authentication) {
        jobOfferService.validate(CurrentUserId.from(authentication), offerId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> publish(UUID offerId, Authentication authentication) {
        jobOfferService.publish(CurrentUserId.from(authentication), offerId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> close(UUID offerId, Authentication authentication) {
        jobOfferService.close(CurrentUserId.from(authentication), offerId);
        return ResponseEntity.noContent().build();
    }
}
