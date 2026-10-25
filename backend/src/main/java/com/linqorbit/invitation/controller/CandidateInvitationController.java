package com.linqorbit.invitation.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.invitation.dto.CandidateInvitationResponse;
import com.linqorbit.invitation.service.CandidateInvitationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/candidates/me/invitations")
@RequiredArgsConstructor
public class CandidateInvitationController implements CandidateInvitationApi {

    private final CandidateInvitationService candidateInvitationService;

    @Override
    public ResponseEntity<List<CandidateInvitationResponse>> mine(Authentication authentication) {
        return ResponseEntity.ok(candidateInvitationService.mine(CurrentUserId.from(authentication)));
    }
}
