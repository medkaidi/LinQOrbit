package com.linqorbit.candidate.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.service.NormalizationStatusBroadcaster.Stream;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferNormalizationService;
import com.linqorbit.joboffer.service.JobOfferValidatedEvent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Publication SSE des transitions de normalisation (D64), toujours <b>après
 * commit</b> : la validation (job PENDING, anciens PENDING supersédés) via les
 * événements {@code AFTER_COMMIT}, les transitions du worker (RUNNING, DONE,
 * retry PENDING, FAILED) après la fin de leur transaction courte.
 *
 * <p>Le statut publié est celui du <b>dernier job de la ressource, relu en
 * base</b> — jamais la transition brute : la transition d'un job supersédé
 * (une édition a créé une version plus récente) déclenche ainsi une relecture
 * et le client reçoit le statut réel, sans fermer un flux encore utile.</p>
 *
 * <p>Une publication ne fait <b>jamais</b> échouer le job ni la validation :
 * toute erreur est journalisée puis ignorée (le client relira par son GET à
 * la reconnexion). Sans abonné, aucune lecture du statut ; la liaison
 * job→ressource est résolue avant le contrôle des abonnés.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NormalizationStatusPublisher {

    private final NormalizationStatusBroadcaster broadcaster;
    private final NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final NormalizationService normalizationService;
    private final JobOfferNormalizationService jobOfferNormalizationService;

    /** Validation de profil commitée : nouveau job PENDING (anciens PENDING supersédés). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onProfileValidated(ProfileValidatedEvent event) {
        publish(event.jobId(), NormalizationSourceType.CANDIDATE);
    }

    /** Validation (ou revalidation) d'offre commitée : même signal côté offre. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onJobOfferValidated(JobOfferValidatedEvent event) {
        publish(event.jobId(), NormalizationSourceType.OFFER);
    }

    /**
     * Publie le statut courant de la ressource du job. À appeler après le
     * commit de la transition ; n'échoue jamais.
     */
    public void publish(UUID jobId, NormalizationSourceType sourceType) {
        try {
            Optional<Stream> stream = streamOf(jobId, sourceType);
            if (stream.isEmpty() || !broadcaster.hasListeners(stream.get())) {
                return;
            }
            broadcaster.publish(stream.get(), latestStatus(stream.get()));
        } catch (RuntimeException ex) {
            log.warn("Normalization status push failed : jobId={}, source={}", jobId, sourceType, ex);
        }
    }

    private Optional<Stream> streamOf(UUID jobId, NormalizationSourceType sourceType) {
        if (sourceType == NormalizationSourceType.OFFER) {
            return normalizedProfileJobOfferRepository.findOfferIdByNormalizedProfileId(jobId).map(Stream::offer);
        }
        return normalizedProfileCandidateRepository.findCandidateIdByNormalizedProfileId(jobId)
                .map(Stream::candidate);
    }

    private NormalizationJobStatus latestStatus(Stream stream) {
        return stream.sourceType() == NormalizationSourceType.OFFER
                ? jobOfferNormalizationService.latestJobStatus(stream.resourceId())
                : normalizationService.latestJobStatus(stream.resourceId());
    }
}
