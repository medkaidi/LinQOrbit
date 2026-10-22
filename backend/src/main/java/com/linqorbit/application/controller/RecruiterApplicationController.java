package com.linqorbit.application.controller;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.application.dto.CriterionReportRequest;
import com.linqorbit.application.dto.RecruiterApplicationDetail;
import com.linqorbit.application.dto.RecruiterApplicationPageResponse;
import com.linqorbit.application.dto.RecruiterDecisionRequest;
import com.linqorbit.application.service.RecruiterApplicationService;
import com.linqorbit.attachment.dto.AttachmentContent;
import com.linqorbit.common.security.CurrentUserId;

@RestController
@RequestMapping("/api/v1/job-offers/{offerId}/applications")
@RequiredArgsConstructor
public class RecruiterApplicationController implements RecruiterApplicationApi {

    private final RecruiterApplicationService recruiterApplicationService;

    @Override
    public ResponseEntity<RecruiterApplicationPageResponse> list(UUID offerId, String status, String sort,
            String direction, Integer page, Integer size, Authentication authentication) {
        return ResponseEntity.ok(recruiterApplicationService.list(CurrentUserId.from(authentication), offerId,
                status, sort, direction, page, size));
    }

    @Override
    public ResponseEntity<RecruiterApplicationDetail> detail(UUID offerId, UUID applicationId,
            Authentication authentication) {
        return ResponseEntity.ok(recruiterApplicationService.detail(CurrentUserId.from(authentication), offerId,
                applicationId));
    }

    @Override
    public ResponseEntity<Resource> cv(UUID offerId, UUID applicationId, Authentication authentication) {
        AttachmentContent content = recruiterApplicationService.cv(CurrentUserId.from(authentication), offerId,
                applicationId);
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(content.attachment().originalName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.attachment().mimeType()))
                .contentLength(content.attachment().sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(content.resource());
    }

    @Override
    public ResponseEntity<Void> decide(UUID offerId, UUID applicationId, RecruiterDecisionRequest request,
            Authentication authentication) {
        recruiterApplicationService.decide(CurrentUserId.from(authentication), offerId, applicationId, request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> reportCriterion(UUID offerId, UUID applicationId, CriterionReportRequest request,
            Authentication authentication) {
        recruiterApplicationService.reportCriterion(CurrentUserId.from(authentication), offerId, applicationId,
                request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
