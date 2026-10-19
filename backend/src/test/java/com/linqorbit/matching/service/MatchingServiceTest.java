package com.linqorbit.matching.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import tools.jackson.databind.json.JsonMapper;

import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.service.ApplicationService;
import com.linqorbit.application.service.ApplicationService.CoupleApplication;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.entity.ClarificationStatus;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingJob;
import com.linqorbit.matching.entity.MatchingJobStatus;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.exception.InvalidMatchingException;
import com.linqorbit.matching.exception.MatchingNotFoundException;
import com.linqorbit.matching.repository.ClarificationRepository;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;

/**
 * Préconditions (D58–D59), identité et versionnement des résultats (D50–D51),
 * vue candidat (score par critère seul). L'unicité réelle et la FK composite
 * sont épinglées par {@code MatchingIntegrationTest} (PostgreSQL réel).
 */
class MatchingServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID OFFER_ID = UUID.randomUUID();
    private static final String PUBLIC_ID = "abc123def456";
    private static final UUID CANDIDATE_SHEET_ID = UUID.randomUUID();
    private static final UUID OFFER_SHEET_ID = UUID.randomUUID();

    private final ApplicationService applicationService = mock(ApplicationService.class);
    private final NormalizedProfileRepository normalizedProfileRepository = mock(NormalizedProfileRepository.class);
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository =
            mock(NormalizedProfileJobOfferRepository.class);
    private final MatchingRepository matchingRepository = mock(MatchingRepository.class);
    private final MatchingResultRepository matchingResultRepository = mock(MatchingResultRepository.class);
    private final MatchingJobRepository matchingJobRepository = mock(MatchingJobRepository.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final MatchingStatusBroadcaster broadcaster = mock(MatchingStatusBroadcaster.class);

    private final CandidateRepository candidateRepository = mock(CandidateRepository.class);
    private final ClarificationRepository clarificationRepository = mock(ClarificationRepository.class);
    private final MatchingCriterionFeedbackRepository feedbackRepository =
            mock(MatchingCriterionFeedbackRepository.class);
    private final MatchingService matchingService = new MatchingService(applicationService,
            normalizedProfileRepository, normalizedProfileJobOfferRepository, matchingRepository,
            matchingResultRepository, matchingJobRepository, eventPublisher, JsonMapper.builder().build(),
            broadcaster, candidateRepository, clarificationRepository, feedbackRepository);

    /** Dernier job enregistré : relu par findById comme le ferait la base. */
    private final AtomicReference<MatchingJob> savedJob = new AtomicReference<>();

    @BeforeEach
    void openOffer() {
        when(applicationService.requireOpenOffer(PUBLIC_ID)).thenReturn(JobOffer.builder().id(OFFER_ID).build());
        when(matchingRepository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(matchingResultRepository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(matchingJobRepository.saveAndFlush(any())).thenAnswer(call -> {
            savedJob.set(call.getArgument(0));
            return call.getArgument(0);
        });
    }

    @Test
    void premierLancementCreeLIdentiteLaVersion1EtLeJobPuisPublieLEvenement() {
        stubCompleteDraft();
        stubSheets("3", "2");
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID, OFFER_ID,
                CANDIDATE_SHEET_ID)).thenReturn(Optional.empty());
        when(matchingRepository.findByIdForUpdate(any()))
                .thenAnswer(call -> Optional.of(Matching.builder().id(call.getArgument(0)).build()));
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(any())).thenReturn(Optional.empty());
        when(matchingResultRepository.findMaxVersionByMatchingId(any())).thenReturn(null);
        when(matchingJobRepository.findById(any())).thenAnswer(call -> Optional.ofNullable(savedJob.get()));

        MatchingResponse response = matchingService.start(USER_ID, PUBLIC_ID);

        // TD-053 : la ligne candidat est verrouillée avant de chercher le matching du couple.
        InOrder lockFirst = inOrder(candidateRepository, matchingRepository);
        lockFirst.verify(candidateRepository).findByIdForUpdate(USER_ID);
        lockFirst.verify(matchingRepository).findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID,
                OFFER_ID, CANDIDATE_SHEET_ID);

        ArgumentCaptor<Matching> matchingCaptor = ArgumentCaptor.forClass(Matching.class);
        verify(matchingRepository).saveAndFlush(matchingCaptor.capture());
        assertThat(matchingCaptor.getValue().getCandidateId()).isEqualTo(USER_ID);
        assertThat(matchingCaptor.getValue().getJobOfferId()).isEqualTo(OFFER_ID);
        assertThat(matchingCaptor.getValue().getCandidateNormalizedProfileId()).isEqualTo(CANDIDATE_SHEET_ID);

        ArgumentCaptor<MatchingResult> resultCaptor = ArgumentCaptor.forClass(MatchingResult.class);
        verify(matchingResultRepository).saveAndFlush(resultCaptor.capture());
        MatchingResult result = resultCaptor.getValue();
        assertThat(result.getVersion()).isEqualTo(1);
        assertThat(result.getSchemaVersion()).isEqualTo("1");
        assertThat(result.getResult()).isNull();
        assertThat(result.getJobOfferNormalizedProfileId()).isEqualTo(OFFER_SHEET_ID);
        assertThat(savedJob.get().getId()).isEqualTo(result.getId());
        assertThat(savedJob.get().getStatus()).isEqualTo(MatchingJobStatus.PENDING);
        assertThat(savedJob.get().getAttempts()).isZero();
        verify(eventPublisher).publishEvent(new MatchingRequestedEvent(result.getId()));

        assertThat(response.status()).isEqualTo("pending");
        assertThat(response.sections()).isEmpty();
    }

    @Test
    void ficheInchangeeEtAnalyseTermineeOuEnCoursSontReprisesSansNouvelleVersion() {
        stubCompleteDraft();
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        for (MatchingJobStatus status : List.of(MatchingJobStatus.PENDING, MatchingJobStatus.RUNNING,
                MatchingJobStatus.DONE)) {
            MatchingResult latest = result(existing.getId(), 2, null);
            when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(existing.getId()))
                    .thenReturn(Optional.of(latest));
            when(matchingJobRepository.findById(latest.getId())).thenReturn(Optional.of(job(latest.getId(), status)));

            assertThat(matchingService.start(USER_ID, PUBLIC_ID).status()).isEqualTo(status.getApiValue());
        }
        verify(matchingRepository, never()).saveAndFlush(any());
        verify(matchingResultRepository, never()).saveAndFlush(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void analyseEchoueeEstRelanceeEnVersionSuivante() {
        stubCompleteDraft();
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        MatchingResult failed = result(existing.getId(), 3, null);
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.of(failed));
        when(matchingResultRepository.findMaxVersionByMatchingId(existing.getId())).thenReturn(3);
        when(matchingJobRepository.findById(any())).thenAnswer(call -> call.getArgument(0).equals(failed.getId())
                ? Optional.of(job(failed.getId(), MatchingJobStatus.FAILED))
                : Optional.ofNullable(savedJob.get()));

        MatchingResponse response = matchingService.start(USER_ID, PUBLIC_ID);

        ArgumentCaptor<MatchingResult> resultCaptor = ArgumentCaptor.forClass(MatchingResult.class);
        verify(matchingResultRepository).saveAndFlush(resultCaptor.capture());
        assertThat(resultCaptor.getValue().getVersion()).isEqualTo(4);
        assertThat(savedJob.get().getId()).isEqualTo(resultCaptor.getValue().getId());
        assertThat(response.status()).isEqualTo("pending");
    }

    @Test
    void lancementRefuseObligatoiresManquantesSansBrouillonOuCandidatureTransmise() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        assertRefused(MatchingService.REQUIRED_FIRST);

        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.DRAFT, false)));
        assertRefused(MatchingService.REQUIRED_FIRST);

        for (ApplicationStatus status : List.of(ApplicationStatus.SUBMITTED, ApplicationStatus.WITHDRAWN,
                ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED)) {
            when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                    .thenReturn(Optional.of(new CoupleApplication(status, true)));
            assertRefused(MatchingService.CLOSED);
        }
        verify(matchingRepository, never()).saveAndFlush(any());
    }

    @Test
    void lancementRefuseFichesAbsentesOuPerimees() {
        stubCompleteDraft();

        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of());
        assertRefused(MatchingService.PROFILE_MISSING);

        stubSheets("2", "2");
        assertRefused(MatchingService.PROFILE_OUTDATED);

        stubSheets("3", "1");
        assertRefused(MatchingService.OFFER_NOT_READY);

        stubSheets("3", null);
        when(normalizedProfileJobOfferRepository.findLatestWithContentByOfferId(any(), any(Pageable.class)))
                .thenReturn(List.of());
        assertRefused(MatchingService.OFFER_NOT_READY);

        verify(matchingRepository, never()).saveAndFlush(any());
    }

    @Test
    void lectureNeMontreQueLeScoreDeChaqueCritereUneFoisTermine() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.DRAFT, true)));
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        MatchingResult done = result(existing.getId(), 1, """
                {"schemaVersion": "1", "policyVersion": "generic-1", "scoringVersion": "weighted-1",
                 "sections": [
                   {"section": "required_skills", "score": 72.5, "criteria": [
                     {"key": "skill:java", "label": "Java", "requirement": "level 4/5", "weight": 5, "score": 80,
                      "rationale": "Recruiter only.", "evidence": [{"source": "skill", "index": 0}]}
                   ]},
                   {"section": "languages", "score": 100.0, "criteria": [
                     {"key": "language:english", "label": "English", "requirement": null, "weight": 1, "score": 100,
                      "rationale": "C2.", "evidence": []}
                   ]}
                 ]}""");
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.of(done));
        when(matchingJobRepository.findById(done.getId())).thenReturn(Optional.of(job(done.getId(),
                MatchingJobStatus.DONE)));

        MatchingResponse response = matchingService.getCurrent(USER_ID, PUBLIC_ID);

        assertThat(response.matchingId()).isEqualTo(existing.getId());
        assertThat(response.status()).isEqualTo("done");
        assertThat(response.sections()).extracting(section -> section.section())
                .containsExactly("required_skills", "languages");
        assertThat(response.sections().get(0).criteria()).singleElement().satisfies(criterion -> {
            assertThat(criterion.key()).isEqualTo("skill:java");
            assertThat(criterion.label()).isEqualTo("Java");
            assertThat(criterion.score()).isEqualTo(80);
        });
    }

    @Test
    void lectureEnCoursOuEchoueeNExposeAucunScore() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        MatchingResult failed = result(existing.getId(), 1, null);
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.of(failed));
        when(matchingJobRepository.findById(failed.getId())).thenReturn(Optional.of(job(failed.getId(),
                MatchingJobStatus.FAILED)));

        MatchingResponse response = matchingService.getCurrent(USER_ID, PUBLIC_ID);

        assertThat(response.status()).isEqualTo("failed");
        assertThat(response.sections()).isEmpty();
    }

    @Test
    void lectureSansMatchingPourLaFicheCouranteEst404EtFermeeApresTransmission() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        stubSheets("3", "2");
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID, OFFER_ID,
                CANDIDATE_SHEET_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> matchingService.getCurrent(USER_ID, PUBLIC_ID))
                .isInstanceOf(MatchingNotFoundException.class);

        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of());
        assertThatThrownBy(() -> matchingService.getCurrent(USER_ID, PUBLIC_ID))
                .isInstanceOf(MatchingNotFoundException.class);

        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.SUBMITTED, true)));
        assertThatThrownBy(() -> matchingService.getCurrent(USER_ID, PUBLIC_ID))
                .isInstanceOf(InvalidMatchingException.class)
                .hasMessage(MatchingService.CLOSED);
    }

    @Test
    void abonnementSseAuMatchingCourantAvecSonStatutEtMemesGardesQueLaLecture() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.DRAFT, true)));
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        MatchingResult running = result(existing.getId(), 1, null);
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.of(running));
        when(matchingJobRepository.findById(running.getId())).thenReturn(Optional.of(job(running.getId(),
                MatchingJobStatus.RUNNING)));
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter =
                new org.springframework.web.servlet.mvc.method.annotation.SseEmitter();
        ArgumentCaptor<Supplier<MatchingJobStatus>> currentStatus = ArgumentCaptor.captor();
        when(broadcaster.subscribe(eq(existing.getId()), currentStatus.capture())).thenReturn(emitter);
        // Le statut est relu en base au moment de l'envoi (après l'inscription) : il a pu avancer.
        when(matchingJobRepository.findStatusById(running.getId())).thenReturn(Optional.of(MatchingJobStatus.DONE));

        assertThat(matchingService.subscribe(USER_ID, PUBLIC_ID)).isSameAs(emitter);
        assertThat(currentStatus.getValue().get()).isEqualTo(MatchingJobStatus.DONE);

        // Candidature transmise : accès fermé avant toute inscription au flux.
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.SUBMITTED, true)));
        assertThatThrownBy(() -> matchingService.subscribe(USER_ID, PUBLIC_ID))
                .isInstanceOf(InvalidMatchingException.class);
        // Aucun matching pour la fiche courante : 404 avant toute inscription.
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID, OFFER_ID,
                CANDIDATE_SHEET_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> matchingService.subscribe(USER_ID, PUBLIC_ID))
                .isInstanceOf(MatchingNotFoundException.class);
        verify(broadcaster).subscribe(eq(existing.getId()), any());
    }

    private void assertRefused(String message) {
        assertThatThrownBy(() -> matchingService.start(USER_ID, PUBLIC_ID))
                .isInstanceOf(InvalidMatchingException.class)
                .hasMessage(message)
                .satisfies(ex -> assertThat(((InvalidMatchingException) ex).getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    // --- Fin d'évaluation (M2) -------------------------------------------------

    @Test
    void terminerUneEvaluationDejaCloseNeTouchePlusRien() {
        stubCompleteDraft();
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        existing.setAssessmentFinishedAt(java.time.LocalDateTime.now());
        stubLatestJob(existing, MatchingJobStatus.DONE, "{\"sections\": []}");
        when(matchingRepository.findByIdForUpdate(existing.getId())).thenReturn(Optional.of(existing));

        matchingService.finishAssessment(USER_ID, PUBLIC_ID);

        verify(clarificationRepository, never()).closeOpen(any(), any(), any());
        verify(matchingRepository, never()).finishAssessment(any(), any());
    }

    @Test
    void terminerSansResultatTermineEstRefuseSansRienFermer() {
        stubCompleteDraft();
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        stubLatestJob(existing, MatchingJobStatus.FAILED, null);
        when(matchingRepository.findByIdForUpdate(existing.getId())).thenReturn(Optional.of(existing));
        when(matchingResultRepository.findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> matchingService.finishAssessment(USER_ID, PUBLIC_ID))
                .isInstanceOfSatisfying(InvalidMatchingException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage()).isEqualTo(MatchingService.NOTHING_TO_REVIEW);
                });
        verify(clarificationRepository, never()).closeOpen(any(), any(), any());
        verify(matchingRepository, never()).finishAssessment(any(), any());
    }

    @Test
    void terminerAvecUnResultatAnterieurTermineEstAccepteMemeSiLaDerniereAnalyseAEchoue() {
        stubCompleteDraft();
        stubSheets("3", "2");
        Matching existing = stubExistingMatching();
        stubLatestJob(existing, MatchingJobStatus.FAILED, null);
        when(matchingRepository.findByIdForUpdate(existing.getId())).thenReturn(Optional.of(existing));
        when(matchingResultRepository.findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(existing.getId()))
                .thenReturn(Optional.of(result(existing.getId(), 1, """
                        {"sections": [{"section": "required_skills", "criteria": [{"key": "skill:java", "score": 80}]}]}""")));

        matchingService.finishAssessment(USER_ID, PUBLIC_ID);

        verify(clarificationRepository).closeOpen(existing.getId(), ClarificationStatus.OPEN,
                ClarificationStatus.SKIPPED);
        verify(matchingRepository).finishAssessment(eq(existing.getId()), any());
    }

    /** Dernier résultat du matching et son job (contenu null = en cours ou en échec). */
    private void stubLatestJob(Matching matching, MatchingJobStatus status, String content) {
        MatchingResult latest = result(matching.getId(), 2, content);
        when(matchingResultRepository.findFirstByMatchingIdOrderByVersionDesc(matching.getId()))
                .thenReturn(Optional.of(latest));
        when(matchingJobRepository.findById(latest.getId())).thenReturn(Optional.of(job(latest.getId(), status)));
    }

    private void stubCompleteDraft() {
        when(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(new CoupleApplication(ApplicationStatus.DRAFT, true)));
    }

    private void stubSheets(String candidateSchema, String offerSchema) {
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(CANDIDATE_SHEET_ID).schemaVersion(candidateSchema)
                        .content("{}").build()));
        when(normalizedProfileJobOfferRepository.findLatestWithContentByOfferId(any(), any(Pageable.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(OFFER_SHEET_ID).schemaVersion(offerSchema)
                        .content("{}").build()));
    }

    private Matching stubExistingMatching() {
        Matching existing = Matching.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .candidateNormalizedProfileId(CANDIDATE_SHEET_ID)
                .build();
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID, OFFER_ID,
                CANDIDATE_SHEET_ID)).thenReturn(Optional.of(existing));
        when(matchingRepository.findByIdForUpdate(existing.getId())).thenReturn(Optional.of(existing));
        return existing;
    }

    private static MatchingResult result(UUID matchingId, int version, String json) {
        return MatchingResult.builder()
                .id(UUID.randomUUID())
                .matchingId(matchingId)
                .version(version)
                .schemaVersion("1")
                .result(json)
                .jobOfferNormalizedProfileId(OFFER_SHEET_ID)
                .build();
    }

    private static MatchingJob job(UUID id, MatchingJobStatus status) {
        return MatchingJob.builder().id(id).status(status).attempts(0).build();
    }
}
