package com.linqorbit.admin;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

import com.linqorbit.admin.dto.AdminDashboardResponse;
import com.linqorbit.common.security.CurrentUserId;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController implements AdminDashboardApi {

    private final AdminDashboardService adminDashboardService;

    @Override
    public ResponseEntity<AdminDashboardResponse> dashboard(Authentication authentication) {
        return ResponseEntity.ok(adminDashboardService.get(CurrentUserId.from(authentication)));
    }
}
