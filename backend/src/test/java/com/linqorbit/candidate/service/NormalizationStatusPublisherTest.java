package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.service.NormalizationStatusBroadcaster.Stream;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferNormalizationService;
import com.linqorbit.joboffer.service.JobOfferValidatedEvent;

/**
 * Publication SSE de normalisation (D64) : ressource résolue depuis le job,
 * statut du <b>dernier</b> job relu (un job supersédé déclenche une
 * relecture), aucune lecture sans abonné, jamais d'échec propagé.
 */
class NormalizationStatusPublisherTest {

    private static final UUID JOB_ID = UUID.fromString("66666666-6666-4666-8666-666666666666");
    private static final UUID CANDIDATE_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");

    private NormalizationStatusBroadcaster broadcaster;
    private NormalizedProfileCandidateRepository candidateLinks;
    private NormalizedProfileJobOfferRepository offerLinks;
    private NormalizationService normalizationService;
    private JobOfferNormalizationService jobOfferNormalizationService;
    private NormalizationStatusPublisher publisher;

    @BeforeEach
    void setUp() {
        broadcaster = mock(NormalizationStatusBroadcaster.class);
        candidateLinks = mock(NormalizedProfileCandidateRepository.class);
        offerLinks = mock(NormalizedProfileJobOfferRepository.class);
        normalizationService = mock(NormalizationService.class);
        jobOfferNormalizationService = mock(JobOfferNormalizationService.class);
        publisher = new NormalizationStatusPublisher(broadcaster, candidateLinks, offerLinks,
                normalizationService, jobOfferNormalizationService);
    }

    @Test
    void publieLeStatutDuDernierJobDuCandidatRelu() {
        when(candidateLinks.findCandidateIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.of(CANDIDATE_ID));
        when(broadcaster.hasListeners(Stream.candidate(CANDIDATE_ID))).thenReturn(true);
        when(normalizationService.latestJobStatus(CANDIDATE_ID)).thenReturn(NormalizationJobStatus.RUNNING);

        publisher.publish(JOB_ID, NormalizationSourceType.CANDIDATE);

        verify(broadcaster).publish(Stream.candidate(CANDIDATE_ID), NormalizationJobStatus.RUNNING);
    }

    @Test
    void laFinDUnJobSupersedePublieLeStatutReelDeLaVersionPlusRecente() {
        // Le job terminé appartient à une ancienne version : le dernier job (édition) est PENDING.
        when(candidateLinks.findCandidateIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.of(CANDIDATE_ID));
        when(broadcaster.hasListeners(Stream.candidate(CANDIDATE_ID))).thenReturn(true);
        when(normalizationService.latestJobStatus(CANDIDATE_ID)).thenReturn(NormalizationJobStatus.PENDING);

        publisher.publish(JOB_ID, NormalizationSourceType.CANDIDATE);

        verify(broadcaster).publish(Stream.candidate(CANDIDATE_ID), NormalizationJobStatus.PENDING);
        verify(broadcaster, never()).publish(any(), org.mockito.ArgumentMatchers.eq(NormalizationJobStatus.DONE));
    }

    @Test
    void uneOffreSeResoutParSaLiaisonEtSaNormalisation() {
        when(offerLinks.findOfferIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.of(OFFER_ID));
        when(broadcaster.hasListeners(Stream.offer(OFFER_ID))).thenReturn(true);
        when(jobOfferNormalizationService.latestJobStatus(OFFER_ID)).thenReturn(NormalizationJobStatus.FAILED);

        publisher.onJobOfferValidated(new JobOfferValidatedEvent(JOB_ID));

        verify(broadcaster).publish(Stream.offer(OFFER_ID), NormalizationJobStatus.FAILED);
        verifyNoInteractions(candidateLinks, normalizationService);
    }

    @Test
    void laValidationDuProfilPublieApresCommitLeNouveauJobEnAttente() {
        when(candidateLinks.findCandidateIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.of(CANDIDATE_ID));
        when(broadcaster.hasListeners(Stream.candidate(CANDIDATE_ID))).thenReturn(true);
        when(normalizationService.latestJobStatus(CANDIDATE_ID)).thenReturn(NormalizationJobStatus.PENDING);

        publisher.onProfileValidated(new ProfileValidatedEvent(JOB_ID));

        verify(broadcaster).publish(Stream.candidate(CANDIDATE_ID), NormalizationJobStatus.PENDING);
        verifyNoInteractions(offerLinks, jobOfferNormalizationService);
    }

    @Test
    void sansAbonneAucunStatutNEstRelu() {
        when(candidateLinks.findCandidateIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.of(CANDIDATE_ID));
        when(broadcaster.hasListeners(Stream.candidate(CANDIDATE_ID))).thenReturn(false);

        publisher.publish(JOB_ID, NormalizationSourceType.CANDIDATE);

        verifyNoInteractions(normalizationService);
        verify(broadcaster, never()).publish(any(), any());
    }

    @Test
    void unJobSansLiaisonNePublieRien() {
        when(offerLinks.findOfferIdByNormalizedProfileId(JOB_ID)).thenReturn(Optional.empty());

        publisher.publish(JOB_ID, NormalizationSourceType.OFFER);

        verify(broadcaster, never()).hasListeners(any());
        verify(broadcaster, never()).publish(any(), any());
    }

    @Test
    void unEchecDePublicationNeRemonteJamais() {
        when(candidateLinks.findCandidateIdByNormalizedProfileId(JOB_ID))
                .thenThrow(new IllegalStateException("database down"));

        assertThatCode(() -> publisher.publish(JOB_ID, NormalizationSourceType.CANDIDATE))
                .doesNotThrowAnyException();

        org.mockito.Mockito.doReturn(Optional.of(CANDIDATE_ID))
                .when(candidateLinks).findCandidateIdByNormalizedProfileId(JOB_ID);
        when(broadcaster.hasListeners(Stream.candidate(CANDIDATE_ID))).thenReturn(true);
        when(normalizationService.latestJobStatus(CANDIDATE_ID)).thenReturn(NormalizationJobStatus.DONE);
        org.mockito.Mockito.doThrow(new IllegalStateException("broken pipe"))
                .when(broadcaster).publish(any(), any());

        assertThatCode(() -> publisher.publish(JOB_ID, NormalizationSourceType.CANDIDATE))
                .doesNotThrowAnyException();
    }
}
