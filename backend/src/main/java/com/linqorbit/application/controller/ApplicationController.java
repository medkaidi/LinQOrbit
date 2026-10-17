package com.linqorbit.application.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.SubmitApplicationRequest;
import com.linqorbit.application.service.ApplicationService;
import com.linqorbit.common.security.CurrentUserId;

@RestController
@RequestMapping("/api/v1/applications")
@RequiredArgsConstructor
public class ApplicationController implements ApplicationApi {

    private final ApplicationService applicationService;

    @Override
    public ResponseEntity<ApplicationResponse> submit(SubmitApplicationRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.submit(CurrentUserId.from(authentication), request));
    }

    @Override
    public ResponseEntity<ApplicationContextResponse> context(String publicId, Authentication authentication) {
        return ResponseEntity.ok(applicationService.getContext(CurrentUserId.from(authentication), publicId));
    }

    @Override
    public ResponseEntity<List<ApplicationResponse>> mine(Authentication authentication) {
        return ResponseEntity.ok(applicationService.listMine(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<Void> withdraw(UUID applicationId, Authentication authentication) {
        applicationService.withdraw(CurrentUserId.from(authentication), applicationId);
        return ResponseEntity.noContent().build();
    }
}
