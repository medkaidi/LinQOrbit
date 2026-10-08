package com.linqorbit.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.ApproveSkillSuggestionRequest;
import com.linqorbit.admin.dto.LinkSkillSuggestionRequest;
import com.linqorbit.admin.dto.UpdateUserStatusRequest;
import com.linqorbit.common.security.CurrentUserId;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController implements AdminApi {

    private final AdminService adminService;

    @Override
    public ResponseEntity<List<AdminUserResponse>> listUsers() {
        return ResponseEntity.ok(adminService.listUsers());
    }

    @Override
    public ResponseEntity<Void> updateUserStatus(UUID userId, UpdateUserStatusRequest request,
            Authentication authentication) {
        adminService.updateUserStatus(userId, request.status(), CurrentUserId.from(authentication));
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<List<AdminSkillSuggestionResponse>> listSkillSuggestions() {
        return ResponseEntity.ok(adminService.listSkillSuggestions());
    }

    @Override
    public ResponseEntity<Void> approveSkillSuggestion(UUID id, ApproveSkillSuggestionRequest request,
            Authentication authentication) {
        adminService.approveSuggestion(id, request.category(), request.skillType(),
                CurrentUserId.from(authentication));
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> linkSkillSuggestion(UUID id, LinkSkillSuggestionRequest request,
            Authentication authentication) {
        adminService.linkSuggestion(id, request.skillId(), CurrentUserId.from(authentication));
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> rejectSkillSuggestion(UUID id, Authentication authentication) {
        adminService.rejectSuggestion(id, CurrentUserId.from(authentication));
        return ResponseEntity.noContent().build();
    }
}
