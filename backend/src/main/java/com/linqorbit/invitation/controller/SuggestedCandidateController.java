package com.linqorbit.invitation.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.invitation.dto.SuggestedCandidateCard;
import com.linqorbit.invitation.dto.SuggestedCandidateProfileResponse;
import com.linqorbit.invitation.dto.SuggestedCandidatesResponse;
import com.linqorbit.invitation.service.InvitationService;
import com.linqorbit.invitation.service.SuggestedCandidateService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/job-offers/{offerId}/suggested-candidates")
@RequiredArgsConstructor
public class SuggestedCandidateController implements SuggestedCandidateApi {

    private final SuggestedCandidateService suggestedCandidateService;
    private final InvitationService invitationService;

    @Override
    public ResponseEntity<SuggestedCandidatesResponse> list(UUID offerId, Authentication authentication) {
        return ResponseEntity.ok(suggestedCandidateService.list(CurrentUserId.from(authentication), offerId));
    }

    @Override
    public ResponseEntity<SuggestedCandidateProfileResponse> profile(UUID offerId, UUID suggestionId,
            Authentication authentication) {
        return ResponseEntity.ok(
                suggestedCandidateService.profile(CurrentUserId.from(authentication), offerId, suggestionId));
    }

    @Override
    public ResponseEntity<SuggestedCandidateCard> invite(UUID offerId, UUID suggestionId,
            Authentication authentication) {
        return ResponseEntity.status(201)
                .body(invitationService.invite(CurrentUserId.from(authentication), offerId, suggestionId));
    }
}
