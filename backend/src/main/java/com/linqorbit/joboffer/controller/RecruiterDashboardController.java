package com.linqorbit.joboffer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse;
import com.linqorbit.joboffer.service.RecruiterDashboardService;

@RestController
@RequestMapping("/api/v1/recruiters/me/dashboard")
@RequiredArgsConstructor
public class RecruiterDashboardController implements RecruiterDashboardApi {

    private final RecruiterDashboardService recruiterDashboardService;

    @Override
    public ResponseEntity<RecruiterDashboardResponse> dashboard(Authentication authentication) {
        return ResponseEntity.ok(recruiterDashboardService.get(CurrentUserId.from(authentication)));
    }
}
