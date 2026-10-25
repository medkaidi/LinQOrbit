package com.linqorbit.joboffer.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferListFilters;
import com.linqorbit.joboffer.dto.JobOfferPageResponse;
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
    public ResponseEntity<JobOfferPageResponse> listMine(Integer page, Integer size, String q, String status,
            UUID workModeId, UUID contractTypeId, UUID employmentTypeId, String seniority, UUID companyId,
            String expiry, Authentication authentication) {
        JobOfferListFilters filters = new JobOfferListFilters(q, status, workModeId, contractTypeId,
                employmentTypeId, seniority, companyId, expiry);
        return ResponseEntity.ok(jobOfferService.listMine(CurrentUserId.from(authentication), page, size, filters));
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
    public SseEmitter normalizationEvents(UUID offerId, Authentication authentication) {
        return jobOfferService.subscribeNormalization(CurrentUserId.from(authentication), offerId);
    }

    @Override
    public ResponseEntity<Void> revalidate(UUID offerId, Authentication authentication) {
        jobOfferService.revalidate(CurrentUserId.from(authentication), offerId);
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
