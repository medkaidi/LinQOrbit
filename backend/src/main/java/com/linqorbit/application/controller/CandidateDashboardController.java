package com.linqorbit.application.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.application.dto.CandidateDashboardResponse;
import com.linqorbit.application.service.CandidateDashboardService;
import com.linqorbit.common.security.CurrentUserId;

@RestController
@RequestMapping("/api/v1/candidates/me/dashboard")
@RequiredArgsConstructor
public class CandidateDashboardController implements CandidateDashboardApi {

    private final CandidateDashboardService candidateDashboardService;

    @Override
    public ResponseEntity<CandidateDashboardResponse> dashboard(Authentication authentication) {
        return ResponseEntity.ok(candidateDashboardService.get(CurrentUserId.from(authentication)));
    }
}
