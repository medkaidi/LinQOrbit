package com.linqorbit.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.ApproveSkillSuggestionRequest;
import com.linqorbit.admin.dto.LinkSkillSuggestionRequest;
import com.linqorbit.admin.dto.UpdateUserStatusRequest;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
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
    public ResponseEntity<AdminUserDetailResponse> getUserDetail(UUID userId) {
        return ResponseEntity.ok(adminService.getUserDetail(userId));
    }

    @Override
    public ResponseEntity<CandidateProfileResponse> getCandidateProfile(UUID userId) {
        return ResponseEntity.ok(adminService.getCandidateProfile(userId));
    }

    @Override
    public ResponseEntity<AdminNormalizedProfileResponse> getCandidateNormalizedProfile(UUID userId) {
        return ResponseEntity.ok(adminService.getCandidateNormalizedProfile(userId));
    }

    @Override
    public ResponseEntity<List<AdminNormalizedProfileResponse>> getCandidateNormalizedProfileVersions(
            UUID userId) {
        return ResponseEntity.ok(adminService.getCandidateNormalizedProfileVersions(userId));
    }

    @Override
    public ResponseEntity<AdminJobOfferPageResponse> listJobOffers(String status, int page, Integer size) {
        return ResponseEntity.ok(adminService.listJobOffers(status, page, size));
    }

    @Override
    public ResponseEntity<AdminJobOfferDetailResponse> getJobOfferDetail(UUID offerId) {
        return ResponseEntity.ok(adminService.getJobOfferDetail(offerId));
    }

    @Override
    public ResponseEntity<AdminNormalizedProfileResponse> getOfferNormalizedProfile(UUID offerId) {
        return ResponseEntity.ok(adminService.getOfferNormalizedProfile(offerId));
    }

    @Override
    public ResponseEntity<List<AdminNormalizedProfileResponse>> getOfferNormalizedProfileVersions(
            UUID offerId) {
        return ResponseEntity.ok(adminService.getOfferNormalizedProfileVersions(offerId));
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
