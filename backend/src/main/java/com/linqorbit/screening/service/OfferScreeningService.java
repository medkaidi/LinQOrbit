package com.linqorbit.screening.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.screening.dto.ScreeningSignal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Surface recruteur du screening d'une offre (T-101) : flux SSE du statut et
 * relance après échec. Les droits sont ceux de l'offre — lecture pour tout
 * membre de la company (404 sûr sinon), relance réservée au droit de gestion
 * D12 (403 sinon) — et vivent ici plutôt que dans {@code ScreeningJobService},
 * qui est appelé par {@code JobOfferService} (pas de dépendance circulaire).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfferScreeningService {

    private final JobOfferService jobOfferService;
    private final ScreeningJobService screeningJobService;
    private final ScreeningSignals screeningSignals;
    private final ScreeningStatusBroadcaster broadcaster;

    /** Flux SSE du statut : inscription d'abord, puis relecture du signal courant (voir le broadcaster). */
    public SseEmitter subscribe(UUID userId, UUID offerId) {
        log.info("Screening status stream requested : offerId={}, recruiterId={}", offerId, userId);
        jobOfferService.getForMember(userId, offerId);
        return broadcaster.subscribe(offerId, () -> screeningSignals.forOffer(offerId)
                .orElseGet(ScreeningSignal::none));
    }

    /** Relance d'un screening échoué (409 sinon, y compris {@code done}). */
    public ScreeningSignal retry(UUID userId, UUID offerId) {
        JobOffer offer = jobOfferService.getForManagement(userId, offerId);
        return screeningJobService.retry(offer);
    }
}
