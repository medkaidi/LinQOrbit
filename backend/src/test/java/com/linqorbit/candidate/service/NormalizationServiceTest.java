package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.entity.NormalizedProfileCandidate;
import com.linqorbit.candidate.exception.EmptyProfileException;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileCandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.repository.CandidateRepository;

class NormalizationServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");

    private CandidateRepository candidateRepository;
    private NormalizedProfileRepository normalizedProfileRepository;
    private NormalizedProfileCandidateRepository normalizedProfileCandidateRepository;
    private NormalizationJobRepository normalizationJobRepository;
    private ApplicationEventPublisher eventPublisher;
    private NormalizationService normalizationService;

    @BeforeEach
    void setUp() {
        candidateRepository = mock(CandidateRepository.class);
        normalizedProfileRepository = mock(NormalizedProfileRepository.class);
        normalizedProfileCandidateRepository = mock(NormalizedProfileCandidateRepository.class);
        normalizationJobRepository = mock(NormalizationJobRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        normalizationService = new NormalizationService(candidateRepository, normalizedProfileRepository,
                normalizedProfileCandidateRepository, normalizationJobRepository, eventPublisher);
    }

    @Test
    void profilJamaisValideEstDirty() {
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(LocalDateTime.now()).build();
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(null);

        assertThat(normalizationService.hasUnvalidatedChanges(candidate)).isTrue();
    }

    @Test
    void ecritureApresValidationRendLeProfilDirty() {
        LocalDateTime validatedAt = LocalDateTime.now().minusHours(1);
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(validatedAt.plusMinutes(5)).build();
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(validatedAt);

        assertThat(normalizationService.hasUnvalidatedChanges(candidate)).isTrue();
    }

    @Test
    void validationApresDerniereEcritureRendLeProfilPropre() {
        LocalDateTime validatedAt = LocalDateTime.now();
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(validatedAt.minusMinutes(5)).build();
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(validatedAt);

        assertThat(normalizationService.hasUnvalidatedChanges(candidate)).isFalse();
    }

    @Test
    void horodatageIdentiqueConsidereCommePropre() {
        LocalDateTime same = LocalDateTime.now();
        Candidate candidate = Candidate.builder().id(USER_ID).updatedAt(same).build();
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(same);

        assertThat(normalizationService.hasUnvalidatedChanges(candidate)).isFalse();
    }

    @Test
    void validationRefuseeQuandProfilInexistant() {
        when(candidateRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> normalizationService.validateProfile(USER_ID))
                .isInstanceOf(EmptyProfileException.class);

        verify(normalizedProfileRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void validationDirtyCreeProfilAssociationEtJobAvecVersion1() {
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(LocalDateTime.now()).build();
        stubLockedDirtyCandidate(candidate);
        when(normalizedProfileRepository.findMaxVersionByCandidateId(USER_ID)).thenReturn(null);

        normalizationService.validateProfile(USER_ID);

        ArgumentCaptor<NormalizedProfile> profileCaptor = ArgumentCaptor.forClass(NormalizedProfile.class);
        verify(normalizedProfileRepository).save(profileCaptor.capture());
        NormalizedProfile profile = profileCaptor.getValue();
        assertThat(profile.getVersion()).isEqualTo(1);
        assertThat(profile.getSchemaVersion()).isEqualTo("1");
        assertThat(profile.getValidatedAt()).isNotNull();
        assertThat(profile.getContent()).isNull();

        ArgumentCaptor<NormalizedProfileCandidate> associationCaptor =
                ArgumentCaptor.forClass(NormalizedProfileCandidate.class);
        verify(normalizedProfileCandidateRepository).save(associationCaptor.capture());
        assertThat(associationCaptor.getValue().getNormalizedProfileId()).isEqualTo(profile.getId());
        assertThat(associationCaptor.getValue().getCandidateId()).isEqualTo(USER_ID);

        ArgumentCaptor<NormalizationJob> jobCaptor = ArgumentCaptor.forClass(NormalizationJob.class);
        verify(normalizationJobRepository).save(jobCaptor.capture());
        NormalizationJob job = jobCaptor.getValue();
        assertThat(job.getId()).isEqualTo(profile.getId());
        assertThat(job.getStatus()).isEqualTo(NormalizationJobStatus.PENDING);
        assertThat(job.getAttempts()).isZero();
        assertThat(job.getNextAttemptAt()).isNotNull();

        verify(normalizationJobRepository).supersedeForCandidate(USER_ID,
                NormalizationJobStatus.PENDING, NormalizationJobStatus.SUPERSEDED);
    }

    @Test
    void validationDirtyIncrementeLaVersionParRapportAUneExistant() {
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(LocalDateTime.now()).build();
        stubLockedDirtyCandidate(candidate);
        when(normalizedProfileRepository.findMaxVersionByCandidateId(USER_ID)).thenReturn(3);

        normalizationService.validateProfile(USER_ID);

        ArgumentCaptor<NormalizedProfile> profileCaptor = ArgumentCaptor.forClass(NormalizedProfile.class);
        verify(normalizedProfileRepository).save(profileCaptor.capture());
        assertThat(profileCaptor.getValue().getVersion()).isEqualTo(4);
    }

    @Test
    void validationSansChangementAvecAnalyseTermineeEstIgnoree() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.DONE);

        normalizationService.validateProfile(USER_ID);

        verify(normalizedProfileRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(normalizedProfileCandidateRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(normalizationJobRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(normalizationJobRepository, never()).supersedeForCandidate(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void validationSansChangementPendantUnJobEnAttenteEstIgnoree() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.PENDING);

        normalizationService.validateProfile(USER_ID);

        verify(normalizedProfileRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(normalizationJobRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void validationRelanceUneAnalyseEnEchecMemeSansChangement() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.FAILED);

        normalizationService.validateProfile(USER_ID);

        verify(normalizedProfileRepository).save(org.mockito.ArgumentMatchers.any());
        verify(normalizationJobRepository).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void echecSignaleQuandLeDernierJobEstFailed() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.FAILED);

        assertThat(normalizationService.hasFailedLatestJob(USER_ID)).isTrue();
    }

    @Test
    void echecNonSignaleQuandLeDernierJobNestPasFailed() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.DONE);
        assertThat(normalizationService.hasFailedLatestJob(USER_ID)).isFalse();

        stubCleanCandidateWithLatestJob(NormalizationJobStatus.PENDING);
        assertThat(normalizationService.hasFailedLatestJob(USER_ID)).isFalse();

        stubCleanCandidateWithLatestJob(NormalizationJobStatus.SUPERSEDED);
        assertThat(normalizationService.hasFailedLatestJob(USER_ID)).isFalse();
    }

    @Test
    void echecNonSignaleSansAucuneValidation() {
        when(normalizedProfileRepository.findLatestByCandidateId(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());

        assertThat(normalizationService.hasFailedLatestJob(USER_ID)).isFalse();
    }

    @Test
    void validationPublieUnEvenementAvecLeJobIdApresCreation() {
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(LocalDateTime.now()).build();
        stubLockedDirtyCandidate(candidate);
        when(normalizedProfileRepository.findMaxVersionByCandidateId(USER_ID)).thenReturn(null);

        normalizationService.validateProfile(USER_ID);

        ArgumentCaptor<ProfileValidatedEvent> eventCaptor = ArgumentCaptor.forClass(ProfileValidatedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        ArgumentCaptor<NormalizedProfile> profileCaptor = ArgumentCaptor.forClass(NormalizedProfile.class);
        verify(normalizedProfileRepository).save(profileCaptor.capture());
        assertThat(eventCaptor.getValue().jobId()).isEqualTo(profileCaptor.getValue().getId());
    }

    @Test
    void aucunePublicationEvenementSurValidationIgnoree() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.DONE);

        normalizationService.validateProfile(USER_ID);

        verify(eventPublisher, never()).publishEvent(
                org.mockito.ArgumentMatchers.any(ProfileValidatedEvent.class));
    }

    @Test
    void analyseEnCoursSignaleePourUnJobPendingOuRunning() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.PENDING);
        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isTrue();

        stubCleanCandidateWithLatestJob(NormalizationJobStatus.RUNNING);
        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isTrue();
    }

    @Test
    void analyseNonEnCoursPourUnJobTerminal() {
        stubCleanCandidateWithLatestJob(NormalizationJobStatus.DONE);
        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isFalse();

        stubCleanCandidateWithLatestJob(NormalizationJobStatus.FAILED);
        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isFalse();

        stubCleanCandidateWithLatestJob(NormalizationJobStatus.SUPERSEDED);
        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isFalse();
    }

    @Test
    void analyseNonEnCoursSansAucuneValidation() {
        when(normalizedProfileRepository.findLatestByCandidateId(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());

        assertThat(normalizationService.hasInProgressLatestJob(USER_ID)).isFalse();
    }

    private void stubLockedDirtyCandidate(Candidate candidate) {
        when(candidateRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(candidate));
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(null);
        when(normalizedProfileRepository.findLatestByCandidateId(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
    }

    private void stubCleanCandidateWithLatestJob(NormalizationJobStatus status) {
        LocalDateTime validatedAt = LocalDateTime.now().minusMinutes(5);
        Candidate candidate = Candidate.builder().id(USER_ID)
                .updatedAt(validatedAt.minusMinutes(5)).build();
        UUID latestProfileId = UUID.randomUUID();
        when(candidateRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.of(candidate));
        when(normalizedProfileRepository.findMaxValidatedAtByCandidateId(USER_ID)).thenReturn(validatedAt);
        when(normalizedProfileRepository.findLatestByCandidateId(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(NormalizedProfile.builder().id(latestProfileId).version(1).build()));
        when(normalizationJobRepository.findById(latestProfileId)).thenReturn(Optional.of(
                NormalizationJob.builder().id(latestProfileId).status(status).build()));
    }
}
