package com.linqorbit.matching.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.RequiredArgsConstructor;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.matching.dto.AnswerClarificationRequest;
import com.linqorbit.matching.dto.MatchingFeedbackResponse;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.SaveMatchingFeedbackRequest;
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

    @Override
    public ResponseEntity<MatchingResponse> answerClarification(String publicId, UUID clarificationId,
            AnswerClarificationRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(matchingService.answerClarification(
                CurrentUserId.from(authentication), publicId, clarificationId, request.answer()));
    }

    @Override
    public ResponseEntity<MatchingResponse> skipClarification(String publicId, UUID clarificationId,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(matchingService.skipClarification(
                CurrentUserId.from(authentication), publicId, clarificationId));
    }

    @Override
    public ResponseEntity<Void> finishAssessment(String publicId, Authentication authentication) {
        matchingService.finishAssessment(CurrentUserId.from(authentication), publicId);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<MatchingFeedbackResponse> saveFeedback(String publicId,
            SaveMatchingFeedbackRequest request, Authentication authentication) {
        return ResponseEntity.ok(matchingService.saveFeedback(CurrentUserId.from(authentication), publicId, request));
    }
}
