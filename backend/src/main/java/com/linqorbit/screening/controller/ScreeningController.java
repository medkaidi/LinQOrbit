package com.linqorbit.screening.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.common.security.CurrentUserId;
import com.linqorbit.screening.dto.ScreeningSignal;
import com.linqorbit.screening.service.OfferScreeningService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/job-offers/{offerId}/screening")
@RequiredArgsConstructor
public class ScreeningController implements ScreeningApi {

    private final OfferScreeningService offerScreeningService;

    @Override
    public SseEmitter events(UUID offerId, Authentication authentication) {
        return offerScreeningService.subscribe(CurrentUserId.from(authentication), offerId);
    }

    @Override
    public ResponseEntity<ScreeningSignal> retry(UUID offerId, Authentication authentication) {
        return ResponseEntity.accepted()
                .body(offerScreeningService.retry(CurrentUserId.from(authentication), offerId));
    }
}
