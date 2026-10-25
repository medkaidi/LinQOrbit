package com.linqorbit.screening.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.linqorbit.screening.dto.ScreeningSignal;
import com.linqorbit.screening.entity.ScreeningJob;
import com.linqorbit.screening.entity.ScreeningJobStatus;
import com.linqorbit.screening.repository.ScreeningJobRepository;

import lombok.RequiredArgsConstructor;

/**
 * Lecture du signal de screening d'une ou plusieurs offres (T-101) : le
 * dernier job non supersédé de chaque offre, jamais un calcul dérivé. Partagé
 * par les réponses d'offre (détail, liste), le flux SSE et sa publication.
 * {@code candidateCount} n'est renseigné que pour un job {@code done}.
 */
@Component
@RequiredArgsConstructor
public class ScreeningSignals {

    private final ScreeningJobRepository screeningJobRepository;

    /** Signal de l'offre, vide si aucun screening n'a été demandé (ou si seuls des jobs supersédés existent). */
    public Optional<ScreeningSignal> forOffer(UUID offerId) {
        return screeningJobRepository.findLatestVisible(offerId, ScreeningJobStatus.SUPERSEDED)
                .map(ScreeningSignals::toSignal);
    }

    /** Signaux d'un lot d'offres en une requête (liste sans N+1) ; une offre sans job est absente de la map. */
    public Map<UUID, ScreeningSignal> forOffers(Collection<UUID> offerIds) {
        if (offerIds.isEmpty()) {
            return Map.of();
        }
        List<ScreeningJob> jobs = screeningJobRepository.findLatestVisibleByOfferIds(offerIds,
                ScreeningJobStatus.SUPERSEDED);
        Map<UUID, ScreeningSignal> signals = new HashMap<>();
        for (ScreeningJob job : jobs) {
            signals.put(job.getJobOfferId(), toSignal(job));
        }
        return signals;
    }

    static ScreeningSignal toSignal(ScreeningJob job) {
        Integer count = job.getStatus() == ScreeningJobStatus.DONE ? job.getCandidateCount() : null;
        return new ScreeningSignal(job.getStatus().getApiValue(), count);
    }
}
