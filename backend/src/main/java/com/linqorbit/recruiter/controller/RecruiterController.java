package com.linqorbit.recruiter.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.dto.UpdateRecruiterRequest;
import com.linqorbit.recruiter.service.RecruiterService;

@RestController
@RequestMapping("/api/v1/recruiters")
@RequiredArgsConstructor
public class RecruiterController implements RecruiterApi {

    private final RecruiterService recruiterService;

    @Override
    public ResponseEntity<RecruiterResponse> create(Authentication authentication) {
        return ResponseEntity.status(201).body(recruiterService.create(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<RecruiterResponse> get(Authentication authentication) {
        return ResponseEntity.ok(recruiterService.get(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<Void> update(UpdateRecruiterRequest request, Authentication authentication) {
        recruiterService.update(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }
}
