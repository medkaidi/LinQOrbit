package com.linqorbit.screening.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.linqorbit.screening.dto.ScreeningSignal;
import com.linqorbit.screening.entity.ScreeningJob;
import com.linqorbit.screening.repository.ScreeningJobRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Publication SSE des transitions de screening (T-101), toujours <b>après
 * commit</b> : appelée par le worker après la fin de chaque transaction de
 * transition et par le service après la création ou la relance d'un job.
 *
 * <p>Le signal publié est celui du <b>dernier job visible de l'offre, relu en
 * base</b> — jamais la transition brute : la transition d'un job supersédé
 * déclenche ainsi une relecture et le client reçoit l'état réel.</p>
 *
 * <p>Une publication ne fait <b>jamais</b> échouer le job : toute erreur est
 * journalisée puis ignorée (le client relira par son GET à la reconnexion).
 * Sans abonné, aucune lecture du signal.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScreeningStatusPublisher {

    private final ScreeningStatusBroadcaster broadcaster;
    private final ScreeningJobRepository screeningJobRepository;
    private final ScreeningSignals screeningSignals;

    /** Publie le signal de l'offre du job. À appeler après le commit de la transition ; n'échoue jamais. */
    public void publish(UUID jobId) {
        try {
            Optional<UUID> offerId = screeningJobRepository.findById(jobId).map(ScreeningJob::getJobOfferId);
            if (offerId.isEmpty() || !broadcaster.hasListeners(offerId.get())) {
                return;
            }
            broadcaster.publish(offerId.get(), screeningSignals.forOffer(offerId.get())
                    .orElseGet(ScreeningSignal::none));
        } catch (RuntimeException ex) {
            log.warn("Screening status push failed : jobId={}", jobId, ex);
        }
    }
}
