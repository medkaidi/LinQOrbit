package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;

import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.service.NormalizationStatusBroadcaster;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;

/**
 * Normalisation d'offre : création du couple profil + job sous lock,
 * no-op (propre, sauf relance FAILED), édition pendant une analyse en vol
 * et dirty-flag — miroir des règles candidat, sans base réelle.
 */
class JobOfferNormalizationServiceTest {

    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");

    private JobOfferRepository jobOfferRepository;
    private NormalizedProfileRepository normalizedProfileRepository;
    private NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private NormalizationJobRepository normalizationJobRepository;
    private ApplicationEventPublisher eventPublisher;
    private JobOfferNormalizationService service;

    @BeforeEach
    void setUp() {
        jobOfferRepository = mock(JobOfferRepository.class);
        normalizedProfileRepository = mock(NormalizedProfileRepository.class);
        normalizedProfileJobOfferRepository = mock(NormalizedProfileJobOfferRepository.class);
        normalizationJobRepository = mock(NormalizationJobRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        service = new JobOfferNormalizationService(jobOfferRepository, normalizedProfileRepository,
                normalizedProfileJobOfferRepository, normalizationJobRepository, eventPublisher,
                mock(NormalizationStatusBroadcaster.class));
    }

    private JobOffer offer(LocalDateTime updatedAt) {
        return JobOffer.builder().id(OFFER_ID).companyId(UUID.randomUUID())
                .recruiterId(UUID.randomUUID()).status(JobOfferStatus.VALIDATED)
                .title("Backend Engineer").updatedAt(updatedAt).build();
    }

    private void stubOffer(LocalDateTime updatedAt) {
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID))
                .thenReturn(Optional.of(offer(updatedAt)));
    }

    private void stubNoHistory() {
        when(normalizedProfileJobOfferRepository.findMaxVersionByOfferId(OFFER_ID)).thenReturn(null);
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID)).thenReturn(null);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of());
    }

    @Test
    void onValidatedCreeUnProfilV1EtUnJobOffer() {
        stubOffer(LocalDateTime.now());
        stubNoHistory();

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository).save(any());
        verify(normalizedProfileJobOfferRepository).save(any());
        verify(normalizationJobRepository).save(any());
        verify(eventPublisher).publishEvent(any(JobOfferValidatedEvent.class));
    }

    @Test
    void onValidatedNumeroteLaVersionEtSupersedeLesPending() {
        stubOffer(LocalDateTime.now());
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxVersionByOfferId(OFFER_ID)).thenReturn(2);
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(LocalDateTime.now().minusDays(1));
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(2).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(NormalizationJobStatus.DONE)
                        .sourceType(NormalizationSourceType.OFFER).build()));

        service.onValidated(OFFER_ID);

        verify(normalizedProfileJobOfferRepository).supersedeForOffer(OFFER_ID,
                NormalizationJobStatus.PENDING, NormalizationJobStatus.SUPERSEDED);
        verify(normalizedProfileRepository).save(any());
    }

    @Test
    void onValidatedCreeUneVersionQuandLOffreEstSaleePendantUneAnalyse() {
        // Miroir candidat : édition pendant un job en vol + re-validation =
        // nouvelle version (les PENDING sont supersédés), pas un no-op qui
        // avalerait l'édition.
        stubOffer(LocalDateTime.now());
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxVersionByOfferId(OFFER_ID)).thenReturn(1);
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(LocalDateTime.now().minusDays(1));
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(1).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(NormalizationJobStatus.PENDING)
                        .sourceType(NormalizationSourceType.OFFER).build()));

        service.onValidated(OFFER_ID);

        verify(normalizedProfileJobOfferRepository).supersedeForOffer(OFFER_ID,
                NormalizationJobStatus.PENDING, NormalizationJobStatus.SUPERSEDED);
        verify(normalizedProfileRepository).save(any());
        verify(eventPublisher).publishEvent(any(JobOfferValidatedEvent.class));
    }

    @Test
    void onValidatedEstNoOpQuandUneAnalyseEstEnCoursSansChangement() {
        // Double-clic / re-POST sans édition : rien à normaliser.
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        stubOffer(validatedAt.minusMinutes(5));
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(validatedAt);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(1).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(NormalizationJobStatus.PENDING)
                        .sourceType(NormalizationSourceType.OFFER).build()));

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void onValidatedEstNoOpQuandRienNaChangeDepuisDone() {
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        stubOffer(validatedAt.minusMinutes(5));
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(validatedAt);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(1).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(NormalizationJobStatus.DONE)
                        .sourceType(NormalizationSourceType.OFFER).build()));

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository, never()).save(any());
    }

    @Test
    void onValidatedRelanceQuandLeDernierJobEstFailed() {
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        stubOffer(validatedAt.minusMinutes(5));
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(validatedAt);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(1).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(NormalizationJobStatus.FAILED)
                        .sourceType(NormalizationSourceType.OFFER).build()));

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository).save(any());
        verify(eventPublisher).publishEvent(any(JobOfferValidatedEvent.class));
    }

    @Test
    void onValidatedRejetteUneOffreInconnue() {
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.onValidated(OFFER_ID))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void hasUnvalidatedChangesEstVraiSansValidation() {
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID))
                .thenReturn(null);

        assertThat(service.hasUnvalidatedChanges(offer(LocalDateTime.now()))).isTrue();
    }

    // --- D63 : analyse obsolète ---------------------------------------------

    @Test
    void findOutdatedOfferIdsCompareChaqueFicheALaVersionOffreSeulement() {
        UUID current = UUID.randomUUID();
        UUID outdated = UUID.randomUUID();
        UUID candidateVersion = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findCurrentSheetSchemaVersions(any())).thenReturn(List.of(
                new Object[] {current, "2"},
                new Object[] {outdated, "1"},
                // "3" est la version candidat : jamais une version offre valable.
                new Object[] {candidateVersion, "3"}));

        assertThat(service.findOutdatedOfferIds(List.of(current, outdated, candidateVersion, UUID.randomUUID())))
                .containsExactlyInAnyOrder(outdated, candidateVersion);
    }

    @Test
    void findOutdatedOfferIdsNInterrogePasLaBaseSansOffre() {
        assertThat(service.findOutdatedOfferIds(List.of())).isEmpty();

        verify(normalizedProfileJobOfferRepository, never()).findCurrentSheetSchemaVersions(any());
    }

    @Test
    void onValidatedRelanceUneFicheObsoleteSansChangement() {
        stubCleanOfferWithLatestJob(NormalizationJobStatus.DONE);
        stubReferenceSheet("1");

        service.onValidated(OFFER_ID);

        org.mockito.ArgumentCaptor<NormalizedProfile> captor = org.mockito.ArgumentCaptor.forClass(NormalizedProfile.class);
        verify(normalizedProfileRepository).save(captor.capture());
        assertThat(captor.getValue().getSchemaVersion()).isEqualTo("2");
        verify(eventPublisher).publishEvent(any(JobOfferValidatedEvent.class));
    }

    @Test
    void onValidatedEstNoOpPourUneFicheObsoleteDejaEnCoursDAnalyse() {
        stubCleanOfferWithLatestJob(NormalizationJobStatus.PENDING);
        stubReferenceSheet("1");

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository, never()).save(any());
        verify(normalizedProfileJobOfferRepository, never()).findCurrentSheetSchemaVersions(any());
    }

    @Test
    void onValidatedEstNoOpPourUneFicheAJourSansChangement() {
        stubCleanOfferWithLatestJob(NormalizationJobStatus.DONE);
        stubReferenceSheet("2");

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository, never()).save(any());
    }

    @Test
    void onValidatedIgnoreLeDirtyFlagDUneOffrePublieeAJour() {
        // publish pose updatedAt après validatedAt : sans la règle D13, une offre
        // PUBLISHED serait toujours « sale » et chaque revalidate créerait une version.
        stubCleanOfferWithLatestJob(NormalizationJobStatus.DONE);
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        JobOffer published = offer(validatedAt.plusMinutes(10));
        published.setStatus(JobOfferStatus.PUBLISHED);
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.of(published));
        stubReferenceSheet("2");

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository, never()).save(any());
    }

    @Test
    void onValidatedRelanceUneOffrePublieeObsolete() {
        stubCleanOfferWithLatestJob(NormalizationJobStatus.DONE);
        JobOffer published = offer(LocalDateTime.now());
        published.setStatus(JobOfferStatus.PUBLISHED);
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.of(published));
        stubReferenceSheet("1");

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository).save(any());
        assertThat(published.getStatus()).isEqualTo(JobOfferStatus.PUBLISHED);
    }

    @Test
    void onValidatedRelanceUneOffrePublieeEnEchec() {
        stubCleanOfferWithLatestJob(NormalizationJobStatus.FAILED);
        JobOffer published = offer(LocalDateTime.now());
        published.setStatus(JobOfferStatus.PUBLISHED);
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.of(published));
        stubReferenceSheet("2");

        service.onValidated(OFFER_ID);

        verify(normalizedProfileRepository).save(any());
    }

    private void stubCleanOfferWithLatestJob(NormalizationJobStatus status) {
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        stubOffer(validatedAt.minusMinutes(5));
        UUID latestId = UUID.randomUUID();
        when(normalizedProfileJobOfferRepository.findMaxValidatedAtByOfferId(OFFER_ID)).thenReturn(validatedAt);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(any(), any(PageRequest.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestId).version(1).build()));
        when(normalizationJobRepository.findById(latestId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestId).status(status)
                        .sourceType(NormalizationSourceType.OFFER).build()));
    }

    private void stubReferenceSheet(String schemaVersion) {
        when(normalizedProfileJobOfferRepository.findCurrentSheetSchemaVersions(List.of(OFFER_ID)))
                .thenReturn(List.<Object[]>of(new Object[] {OFFER_ID, schemaVersion}));
    }
}
