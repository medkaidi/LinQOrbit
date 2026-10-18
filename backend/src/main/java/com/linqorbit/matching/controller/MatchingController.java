package com.linqorbit.matching.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.StartMatchingRequest;
import com.linqorbit.matching.service.MatchingService;

@RestController
@RequestMapping("/api/v1/matchings")
@RequiredArgsConstructor
public class MatchingController implements MatchingApi {

    private final MatchingService matchingService;

    @Override
    public ResponseEntity<MatchingResponse> start(StartMatchingRequest request, Authentication authentication) {
        return ResponseEntity.ok(matchingService.start(CurrentUserId.from(authentication), request.jobPublicId()));
    }

    @Override
    public ResponseEntity<MatchingResponse> current(String publicId, Authentication authentication) {
        return ResponseEntity.ok(matchingService.getCurrent(CurrentUserId.from(authentication), publicId));
    }

    @Override
    public SseEmitter events(String publicId, Authentication authentication) {
        return matchingService.subscribe(CurrentUserId.from(authentication), publicId);
    }
}
