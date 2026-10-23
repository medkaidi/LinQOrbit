package com.linqorbit.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import com.linqorbit.application.dto.ApplicationAnswerOptionView;
import com.linqorbit.application.dto.ApplicationAnswerRequest;
import com.linqorbit.application.dto.ApplicationAnswerView;
import com.linqorbit.application.dto.ApplicationAssessmentView;
import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.SaveApplicationDraftRequest;
import com.linqorbit.application.dto.SubmitApplicationRequest;
import com.linqorbit.application.entity.Application;
import com.linqorbit.application.entity.ApplicationAnswer;
import com.linqorbit.application.entity.ApplicationAnswerOption;
import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.exception.ApplicationNotFoundException;
import com.linqorbit.application.exception.InvalidApplicationException;
import com.linqorbit.application.repository.ApplicationAnswerOptionRepository;
import com.linqorbit.application.repository.ApplicationAnswerRepository;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.attachment.entity.Attachment;
import com.linqorbit.attachment.repository.AttachmentRepository;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferQuestion;
import com.linqorbit.joboffer.entity.JobOfferQuestionOption;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.QuestionType;
import com.linqorbit.joboffer.repository.JobOfferQuestionOptionRepository;
import com.linqorbit.joboffer.repository.JobOfferQuestionRepository;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;

/**
 * Candidature en brouillon (D59) : enregistrement par étages, remplacement
 * des réponses, transmission, abandon, contexte avec l'étape calculée, liste
 * et retrait. Repositories mockés — l'ordre réel des INSERT et la chaîne FK
 * sont épinglés par {@code ApplicationIntegrationTest} (PostgreSQL réel).
 */
class ApplicationServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID OFFER_ID = UUID.randomUUID();
    private static final UUID COMPANY_ID = UUID.randomUUID();
    private static final UUID CV_ID = UUID.randomUUID();
    private static final String PUBLIC_ID = "abc123def456";

    private final ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
    private final ApplicationAnswerRepository applicationAnswerRepository = mock(ApplicationAnswerRepository.class);
    private final ApplicationAnswerOptionRepository applicationAnswerOptionRepository =
            mock(ApplicationAnswerOptionRepository.class);
    private final JobOfferRepository jobOfferRepository = mock(JobOfferRepository.class);
    private final JobOfferQuestionRepository jobOfferQuestionRepository = mock(JobOfferQuestionRepository.class);
    private final JobOfferQuestionOptionRepository jobOfferQuestionOptionRepository =
            mock(JobOfferQuestionOptionRepository.class);
    private final AttachmentRepository attachmentRepository = mock(AttachmentRepository.class);
    private final CompanyRepository companyRepository = mock(CompanyRepository.class);
    private final CandidateService candidateService = mock(CandidateService.class);
    private final NormalizedProfileRepository normalizedProfileRepository = mock(NormalizedProfileRepository.class);
    private final MatchingRepository matchingRepository = mock(MatchingRepository.class);
    private final MatchingResultRepository matchingResultRepository = mock(MatchingResultRepository.class);

    private final CandidateRepository candidateRepository = mock(CandidateRepository.class);
    private final MatchingCriterionFeedbackRepository feedbackRepository =
            mock(MatchingCriterionFeedbackRepository.class);
    private final ApplicationService applicationService = new ApplicationService(applicationRepository,
            applicationAnswerRepository, applicationAnswerOptionRepository, jobOfferRepository,
            jobOfferQuestionRepository, jobOfferQuestionOptionRepository, attachmentRepository, companyRepository,
            candidateService, candidateRepository, normalizedProfileRepository, matchingRepository,
            matchingResultRepository, feedbackRepository);

    /** Par défaut le compte a sa ligne candidat (verrouillée à l'enregistrement du brouillon). */
    @BeforeEach
    void candidateExists() {
        when(candidateRepository.findByIdForUpdate(USER_ID))
                .thenReturn(Optional.of(Candidate.builder().id(USER_ID).build()));
    }

    // --- Brouillon ---------------------------------------------------------

    @Test
    void brouillonRefuseEn409UnCompteSansProfilCandidatSansRienEcrire() {
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        when(candidateRepository.findByIdForUpdate(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> applicationService.saveDraft(USER_ID, draft(List.of())))
                .isInstanceOfSatisfying(InvalidApplicationException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(ex.getMessage()).isEqualTo(ApplicationService.PROFILE_REQUIRED);
                });
        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void premierEnregistrementCreeLeBrouillonAvecLeCvCourantPuisInsereParEtages() {
        JobOfferQuestion text = question(1, QuestionType.TEXT, true, 0);
        JobOfferQuestion single = question(2, QuestionType.SINGLE_CHOICE, true, 1);
        JobOfferQuestion multiple = question(3, QuestionType.MULTIPLE_CHOICE, false, 2);
        JobOfferQuestion yesNo = question(4, QuestionType.YES_NO, true, 3);
        JobOfferQuestion number = question(5, QuestionType.NUMBER, true, 4);
        JobOfferQuestionOption singleA = option(11, single.getId(), "Yes, remote");
        JobOfferQuestionOption singleB = option(12, single.getId(), "On site");
        JobOfferQuestionOption multipleA = option(13, multiple.getId(), "Java");
        JobOfferQuestionOption multipleB = option(14, multiple.getId(), "Spring");

        stubOpenOffer();
        stubCurrentCv("my cv.pdf");
        stubQuestions(List.of(text, single, multiple, yesNo, number), List.of(singleA, singleB, multipleA, multipleB));
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        when(attachmentRepository.findById(CV_ID)).thenReturn(Optional.of(attachment("my cv.pdf")));

        // Réponses volontairement dans le désordre : la sortie suit l'ordre des questions.
        ApplicationResponse response = applicationService.saveDraft(USER_ID, draft(List.of(
                answer(number.getId(), null, new BigDecimal("42.50"), null, null),
                answer(multiple.getId(), null, null, null, List.of(multipleB.getId(), multipleA.getId(),
                        multipleA.getId())),
                answer(text.getId(), "  Backend fan  ", null, null, null),
                answer(single.getId(), null, null, null, List.of(singleB.getId())),
                answer(yesNo.getId(), null, null, true, null))));

        // TD-053 : la ligne candidat est verrouillée avant de chercher le brouillon du couple.
        InOrder lockFirst = inOrder(candidateRepository, applicationRepository);
        lockFirst.verify(candidateRepository).findByIdForUpdate(USER_ID);
        lockFirst.verify(applicationRepository).findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID);

        ArgumentCaptor<Application> applicationCaptor = ArgumentCaptor.forClass(Application.class);
        ArgumentCaptor<List<ApplicationAnswer>> answersCaptor = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<ApplicationAnswerOption>> selectionsCaptor = ArgumentCaptor.forClass(List.class);
        InOrder stages = inOrder(applicationRepository, applicationAnswerRepository,
                applicationAnswerOptionRepository);
        stages.verify(applicationRepository).saveAndFlush(applicationCaptor.capture());
        stages.verify(applicationAnswerRepository).saveAllAndFlush(answersCaptor.capture());
        stages.verify(applicationAnswerOptionRepository).saveAllAndFlush(selectionsCaptor.capture());
        verify(applicationAnswerRepository, never()).deleteByApplicationIdInBulk(any());

        Application application = applicationCaptor.getValue();
        assertThat(application.getCandidateId()).isEqualTo(USER_ID);
        assertThat(application.getJobOfferId()).isEqualTo(OFFER_ID);
        assertThat(application.getCvAttachmentId()).isEqualTo(CV_ID);
        assertThat(application.getMatchingId()).isNull();
        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.DRAFT);

        List<ApplicationAnswer> answers = answersCaptor.getValue();
        assertThat(answers).extracting(ApplicationAnswer::getQuestionId).containsExactly(text.getId(), single.getId(),
                multiple.getId(), yesNo.getId(), number.getId());
        assertThat(answers.get(0).getApplicationId()).isEqualTo(application.getId());
        assertThat(answers.get(0).getJobOfferId()).isEqualTo(OFFER_ID);
        assertThat(answers.get(0).getAnswerText()).isEqualTo("Backend fan");
        assertThat(answers.get(4).getAnswerNumber()).isEqualByComparingTo("42.50");

        // QCS (1 sélection) + QCM (dédupliqué, ordre du client conservé) = 3 lignes.
        assertThat(selectionsCaptor.getValue()).extracting(ApplicationAnswerOption::getOptionId)
                .containsExactly(singleB.getId(), multipleB.getId(), multipleA.getId());

        assertThat(response.status()).isEqualTo("draft");
        assertThat(response.job().companyName()).isEqualTo("Acme");
        assertThat(response.cv().originalName()).isEqualTo("my cv.pdf");
        assertThat(response.answers()).extracting(ApplicationAnswerView::questionId)
                .containsExactly(text.getId(), single.getId(), multiple.getId(), yesNo.getId(), number.getId());
        assertThat(response.answers().get(1).value())
                .isEqualTo(new ApplicationAnswerOptionView(singleB.getId(), "On site"));
        assertThat(response.answers().get(2).value()).isEqualTo(List.of(
                new ApplicationAnswerOptionView(multipleB.getId(), "Spring"),
                new ApplicationAnswerOptionView(multipleA.getId(), "Java")));
    }

    @Test
    void brouillonSansCvCourantEtPartielEstAccepte() {
        JobOfferQuestion required = question(1, QuestionType.TEXT, true, 0);
        stubOpenOffer();
        stubQuestions(List.of(required), List.of());
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.empty());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());

        ApplicationResponse response = applicationService.saveDraft(USER_ID, draft(null));

        ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
        verify(applicationRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getCvAttachmentId()).isNull();
        assertThat(response.cv()).isNull();
        assertThat(response.answers()).isEmpty();
        verify(applicationAnswerRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void reenregistrementRemplaceLesReponsesDuBrouillonSansRecreerLaCandidature() {
        JobOfferQuestion text = question(1, QuestionType.TEXT, false, 0);
        Application existing = application(ApplicationStatus.DRAFT, CV_ID);
        stubOpenOffer();
        stubQuestions(List.of(text), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.of(existing));

        applicationService.saveDraft(USER_ID, draft(List.of(answer(text.getId(), "Updated", null, null, null))));

        InOrder order = inOrder(applicationAnswerRepository);
        order.verify(applicationAnswerRepository).deleteByApplicationIdInBulk(existing.getId());
        order.verify(applicationAnswerRepository).saveAllAndFlush(anyList());
        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void uneCandidatureTransmiseNeSeModifiePlus() {
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(application(ApplicationStatus.WITHDRAWN, CV_ID)));

        assertStatus(() -> applicationService.saveDraft(USER_ID, draft(List.of())), HttpStatus.CONFLICT);

        verify(applicationAnswerRepository, never()).deleteByApplicationIdInBulk(any());
        verify(applicationAnswerRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void brouillonRejetteLesReponsesInvalides() {
        JobOfferQuestion text = question(1, QuestionType.TEXT, true, 0);
        JobOfferQuestion single = question(2, QuestionType.SINGLE_CHOICE, false, 1);
        JobOfferQuestion multiple = question(3, QuestionType.MULTIPLE_CHOICE, false, 2);
        JobOfferQuestion yesNo = question(4, QuestionType.YES_NO, false, 3);
        JobOfferQuestion number = question(5, QuestionType.NUMBER, false, 4);
        JobOfferQuestionOption singleA = option(11, single.getId(), "A");
        JobOfferQuestionOption multipleA = option(13, multiple.getId(), "B");
        UUID foreignQuestionId = UUID.randomUUID();
        UUID foreignOptionId = UUID.randomUUID();
        stubOpenOffer();
        stubQuestions(List.of(text, single, multiple, yesNo, number), List.of(singleA, multipleA));

        assertDraftBadRequest(List.of(answer(foreignQuestionId, "x", null, null, null))); // question inconnue
        assertDraftBadRequest(List.of(answer(text.getId(), "  ", null, null, null))); // texte vide
        assertDraftBadRequest(List.of(answer(text.getId(), "ok", null, null, List.of(singleA.getId()))));
        assertDraftBadRequest(List.of(answer(text.getId(), null, new BigDecimal("10.999"), null, null)));
        assertDraftBadRequest(List.of(answer(number.getId(), null, new BigDecimal("10.999"), null, null)));
        assertDraftBadRequest(List.of(answer(number.getId(), null, new BigDecimal("10000000000.00"), null, null)));
        assertDraftBadRequest(List.of(answer(yesNo.getId(), null, null, null, null))); // oui/non sans valeur
        assertDraftBadRequest(List.of(answer(yesNo.getId(), null, new BigDecimal("1"), true, null))); // 2 porteurs
        assertDraftBadRequest(List.of(answer(single.getId(), null, null, null, List.of()))); // QCS sans option
        assertDraftBadRequest(List.of(answer(single.getId(), null, null, null,
                List.of(singleA.getId(), multipleA.getId())))); // QCS à 2 options
        assertDraftBadRequest(List.of(answer(single.getId(), null, null, null, List.of(foreignOptionId))));
        assertDraftBadRequest(List.of(answer(multiple.getId(), null, null, null, List.of()))); // QCM vide
        assertDraftBadRequest(List.of(answer(multiple.getId(), null, null, null, List.of(foreignOptionId))));
        assertDraftBadRequest(List.of(answer(text.getId(), "ok", null, null, null),
                answer(text.getId(), "again", null, null, null))); // doublon de question

        verify(applicationRepository, never()).saveAndFlush(any());
        verify(applicationAnswerRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void brouillonRejetteUneOffreInconnueNonPublieeOuExpiree() {
        assertDraftOfferUnavailable(null);
        assertDraftOfferUnavailable(offer(JobOfferStatus.DRAFT, null));
        assertDraftOfferUnavailable(offer(JobOfferStatus.CLOSED, null));
        assertDraftOfferUnavailable(offer(JobOfferStatus.PUBLISHED, LocalDate.now().minusDays(1)));

        verify(applicationRepository, never()).saveAndFlush(any());
    }

    // --- Transmission ------------------------------------------------------

    @Test
    void transmissionFigeLeCvDuBrouillonEtRattacheLeMatchingDeLaFicheCourante() {
        JobOfferQuestion required = question(1, QuestionType.TEXT, true, 0);
        Application draft = application(ApplicationStatus.DRAFT, CV_ID);
        UUID sheetId = UUID.randomUUID();
        UUID matchingId = UUID.randomUUID();
        stubOwned(draft);
        stubOfferById(offer(JobOfferStatus.PUBLISHED, null));
        stubQuestions(List.of(required), List.of());
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId())))
                .thenReturn(List.of(textAnswer(draft.getId(), required.getId(), "Because")));
        when(attachmentRepository.findByIdAndCandidateId(CV_ID, USER_ID)).thenReturn(Optional.of(attachment("cv.pdf")));
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of(NormalizedProfile.builder().id(sheetId).build()));
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(USER_ID, OFFER_ID,
                sheetId)).thenReturn(Optional.of(Matching.builder().id(matchingId).build()));

        ApplicationResponse response = applicationService.submit(USER_ID, draft.getId(), null);

        assertThat(draft.getStatus()).isEqualTo(ApplicationStatus.SUBMITTED);
        assertThat(draft.getCvAttachmentId()).isEqualTo(CV_ID);
        assertThat(draft.getMatchingId()).isEqualTo(matchingId);
        verify(applicationRepository).saveAndFlush(draft);
        assertThat(response.status()).isEqualTo("submitted");
        assertThat(response.answers()).extracting(ApplicationAnswerView::value).containsExactly("Because");
    }

    @Test
    void transmissionDirecteSansMatchingNiFicheLaisseMatchingIdNul() {
        Application draft = application(ApplicationStatus.DRAFT, null);
        UUID chosenCv = UUID.randomUUID();
        stubOwned(draft);
        stubOfferById(offer(JobOfferStatus.PUBLISHED, null));
        stubQuestions(List.of(), List.of());
        when(attachmentRepository.findByIdAndCandidateId(chosenCv, USER_ID))
                .thenReturn(Optional.of(attachmentWithId(chosenCv, "chosen.pdf")));
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of());

        applicationService.submit(USER_ID, draft.getId(), new SubmitApplicationRequest(chosenCv));

        assertThat(draft.getCvAttachmentId()).isEqualTo(chosenCv);
        assertThat(draft.getMatchingId()).isNull();
        verifyNoInteractions(matchingRepository);
    }

    @Test
    void transmissionSansCvChoisiNiBrouillonPrendLeCvCourant() {
        Application draft = application(ApplicationStatus.DRAFT, null);
        stubOwned(draft);
        stubOfferById(offer(JobOfferStatus.PUBLISHED, null));
        stubQuestions(List.of(), List.of());
        stubCurrentCv("current.pdf");
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(any(), any(Pageable.class)))
                .thenReturn(List.of());

        applicationService.submit(USER_ID, draft.getId(), new SubmitApplicationRequest(null));

        assertThat(draft.getCvAttachmentId()).isEqualTo(CV_ID);
    }

    @Test
    void transmissionRefuseObligatoireManquanteCvInconnuOuAbsentEtOffreFermee() {
        JobOfferQuestion required = question(1, QuestionType.TEXT, true, 0);
        Application draft = application(ApplicationStatus.DRAFT, null);
        stubOwned(draft);
        stubOfferById(offer(JobOfferStatus.PUBLISHED, null));
        stubQuestions(List.of(required), List.of());

        // Obligatoire sans réponse enregistrée.
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId()))).thenReturn(List.of());
        assertStatus(() -> applicationService.submit(USER_ID, draft.getId(), null), HttpStatus.BAD_REQUEST);

        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId())))
                .thenReturn(List.of(textAnswer(draft.getId(), required.getId(), "ok")));
        // CV choisi qui n'appartient pas au candidat.
        assertStatus(() -> applicationService.submit(USER_ID, draft.getId(),
                new SubmitApplicationRequest(UUID.randomUUID())), HttpStatus.BAD_REQUEST);
        // Aucun CV du tout.
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.empty());
        assertStatus(() -> applicationService.submit(USER_ID, draft.getId(), null), HttpStatus.CONFLICT);
        // Offre fermée entre-temps.
        stubOfferById(offer(JobOfferStatus.CLOSED, null));
        assertStatus(() -> applicationService.submit(USER_ID, draft.getId(), null), HttpStatus.NOT_FOUND);

        assertThat(draft.getStatus()).isEqualTo(ApplicationStatus.DRAFT);
        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void transmissionRefuseUneCandidatureDejaTransmiseOuInconnue() {
        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        stubOwned(submitted);
        assertStatus(() -> applicationService.submit(USER_ID, submitted.getId(), null), HttpStatus.CONFLICT);

        UUID unknown = UUID.randomUUID();
        when(applicationRepository.findByIdAndCandidateIdForUpdate(unknown, USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> applicationService.submit(USER_ID, unknown, null))
                .isInstanceOf(ApplicationNotFoundException.class);
    }

    // --- Abandon -----------------------------------------------------------

    @Test
    void abandonSupprimeUnBrouillonEtRefuseUneCandidatureTransmise() {
        Application draft = application(ApplicationStatus.DRAFT, CV_ID);
        stubOwned(draft);
        applicationService.discard(USER_ID, draft.getId());
        verify(applicationRepository).delete(draft);

        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        stubOwned(submitted);
        assertStatus(() -> applicationService.discard(USER_ID, submitted.getId()), HttpStatus.CONFLICT);
        verify(applicationRepository, never()).delete(submitted);

        UUID unknown = UUID.randomUUID();
        when(applicationRepository.findByIdAndCandidateId(unknown, USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> applicationService.discard(USER_ID, unknown))
                .isInstanceOf(ApplicationNotFoundException.class);
    }

    // --- Contexte : étape calculée ------------------------------------------

    @Test
    void contexteSansCandidatureEstALEtapeQuestionsRecruteurSansPreferred() {
        JobOfferQuestion choice = question(2, QuestionType.SINGLE_CHOICE, true, 1);
        JobOfferQuestion text = question(1, QuestionType.TEXT, false, 0);
        JobOfferQuestionOption preferred = JobOfferQuestionOption.builder()
                .id(UUID.randomUUID())
                .questionId(choice.getId())
                .label("Ideal")
                .sortOrder(0)
                .preferred(true)
                .build();
        stubOpenOffer();
        stubQuestions(List.of(text, choice), List.of(preferred));
        stubCurrentCv("cv.pdf");
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.questions()).extracting(question -> question.id())
                .containsExactly(text.getId(), choice.getId());
        assertThat(context.questions().get(1).options()).extracting(option -> option.label()).containsExactly("Ideal");
        assertThat(context.currentCvAttachmentId()).isEqualTo(CV_ID);
        assertThat(context.existingApplication()).isNull();
        assertThat(context.answers()).isEmpty();
        assertThat(context.step()).isEqualTo("recruiter_questions");
        assertThat(context.canSubmit()).isFalse();
    }

    @Test
    void contexteSansQuestionOuvreDirectementLEtapeMatchingAvantToutBrouillon() {
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        stubCurrentCv("cv.pdf");
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.existingApplication()).isNull();
        assertThat(context.step()).isEqualTo("matching");
        assertThat(context.canSubmit()).isTrue();
    }

    @Test
    void contexteAvecQuestionsFacultativesSeulesResteAuxQuestionsSansBrouillon() {
        stubOpenOffer();
        stubQuestions(List.of(question(1, QuestionType.TEXT, false, 0)), List.of());
        stubCurrentCv("cv.pdf");
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        // Des questions à montrer, même facultatives : l'étape 1 s'affiche.
        assertThat(context.step()).isEqualTo("recruiter_questions");
        assertThat(context.canSubmit()).isFalse();
    }

    @Test
    void contexteSuitLaCompletudeDuBrouillonPuisLaTransmission() {
        JobOfferQuestion required = question(1, QuestionType.TEXT, true, 0);
        JobOfferQuestion optional = question(2, QuestionType.TEXT, false, 1);
        Application draft = application(ApplicationStatus.DRAFT, null);
        stubOpenOffer();
        stubQuestions(List.of(required, optional), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.of(draft));

        // Brouillon partiel : l'obligatoire manque.
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId())))
                .thenReturn(List.of(textAnswer(draft.getId(), optional.getId(), "Optional only")));
        ApplicationContextResponse partial = applicationService.getContext(USER_ID, PUBLIC_ID);
        assertThat(partial.existingApplication().status()).isEqualTo("draft");
        assertThat(partial.existingApplication().cvAttachmentId()).isNull();
        assertThat(partial.answers()).extracting(ApplicationAnswerView::value).containsExactly("Optional only");
        assertThat(partial.step()).isEqualTo("recruiter_questions");
        assertThat(partial.canSubmit()).isFalse();

        // Obligatoire répondue : matching ouvert, transmission possible.
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId())))
                .thenReturn(List.of(textAnswer(draft.getId(), required.getId(), "Done")));
        ApplicationContextResponse complete = applicationService.getContext(USER_ID, PUBLIC_ID);
        assertThat(complete.step()).isEqualTo("matching");
        assertThat(complete.canSubmit()).isTrue();

        // Toute candidature transmise (même retirée) est à l'étape « submitted ».
        draft.setStatus(ApplicationStatus.WITHDRAWN);
        ApplicationContextResponse withdrawn = applicationService.getContext(USER_ID, PUBLIC_ID);
        assertThat(withdrawn.existingApplication().status()).isEqualTo("withdrawn");
        assertThat(withdrawn.step()).isEqualTo("submitted");
        assertThat(withdrawn.canSubmit()).isFalse();
    }

    // --- Contexte : évaluation IA ------------------------------------------

    @Test
    void contexteSansMatchingNeProposePasDUneEvaluationOuverte() {
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        stubCurrentCv("cv.pdf");
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(USER_ID, PageRequest.of(0, 1)))
                .thenReturn(List.of());

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.assessment()).isEqualTo(ApplicationAssessmentView.NONE);
        assertThat(context.assessment().assessmentOpen()).isFalse();
    }

    @Test
    void brouillonAvecMatchingNonClosExposeUneEvaluationOuverte() {
        Application draft = application(ApplicationStatus.DRAFT, null);
        Matching matching = matching(null);
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        stubCurrentCv("cv.pdf");
        stubCurrentMatching(matching);
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.of(draft));

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.step()).isEqualTo("matching");
        assertThat(context.assessment()).isEqualTo(new ApplicationAssessmentView(true, true, false, false));
    }

    @Test
    void matchingClosExposeLaRevueEtLaContestation() {
        Application draft = application(ApplicationStatus.DRAFT, null);
        Matching matching = matching(LocalDateTime.now());
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        stubCurrentCv("cv.pdf");
        stubCurrentMatching(matching);
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.of(draft));
        MatchingResult latest = MatchingResult.builder().id(UUID.randomUUID()).build();
        when(matchingResultRepository
                .findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(matching.getId()))
                .thenReturn(Optional.of(latest));
        when(feedbackRepository.existsByMatchingResultId(latest.getId())).thenReturn(true);

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.assessment()).isEqualTo(new ApplicationAssessmentView(true, false, true, true));
    }

    @Test
    void candidatureTransmiseSuitLeMatchingRattacheSansChercherLeMatchingCourant() {
        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        Matching attached = matching(null);
        submitted.setMatchingId(attached.getId());
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(submitted));
        when(matchingRepository.findById(attached.getId())).thenReturn(Optional.of(attached));

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.step()).isEqualTo("submitted");
        assertThat(context.assessment()).isEqualTo(new ApplicationAssessmentView(true, true, false, false));
        verifyNoInteractions(normalizedProfileRepository);
    }

    @Test
    void candidatureTransmiseSansMatchingRattacheNaPasDEvaluation() {
        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        stubOpenOffer();
        stubQuestions(List.of(), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(submitted));

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.assessment()).isEqualTo(ApplicationAssessmentView.NONE);
        verifyNoInteractions(normalizedProfileRepository, matchingRepository);
    }

    @Test
    void candidatureDuCoupleExposeStatutEtCompletudePourLeMatching() {
        JobOfferQuestion required = question(1, QuestionType.TEXT, true, 0);
        Application draft = application(ApplicationStatus.DRAFT, null);
        stubQuestions(List.of(required), List.of());
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.of(draft));
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId()))).thenReturn(List.of());

        assertThat(applicationService.findCoupleApplication(USER_ID, OFFER_ID))
                .contains(new ApplicationService.CoupleApplication(ApplicationStatus.DRAFT, false));

        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());
        assertThat(applicationService.findCoupleApplication(USER_ID, OFFER_ID)).isEmpty();
    }

    // --- Liste et retrait --------------------------------------------------

    @Test
    void mesCandidaturesReconstruisentLesValeursEtToleresUnBrouillonSansCv() {
        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        Application draft = application(ApplicationStatus.DRAFT, null);
        JobOfferQuestion text = question(1, QuestionType.TEXT, true, 0);
        JobOfferQuestion single = question(2, QuestionType.SINGLE_CHOICE, true, 1);
        JobOfferQuestionOption preferred = JobOfferQuestionOption.builder()
                .id(new UUID(0, 11))
                .questionId(single.getId())
                .label("Yes")
                .sortOrder(0)
                .preferred(true)
                .build();
        ApplicationAnswer textAnswer = textAnswer(submitted.getId(), text.getId(), "Hello");
        ApplicationAnswer singleAnswer = ApplicationAnswer.builder()
                .id(UUID.randomUUID())
                .applicationId(submitted.getId())
                .jobOfferId(OFFER_ID)
                .questionId(single.getId())
                .build();
        ApplicationAnswerOption selection = ApplicationAnswerOption.builder()
                .applicationAnswerId(singleAnswer.getId())
                .questionId(single.getId())
                .optionId(preferred.getId())
                .build();
        when(applicationRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(USER_ID))
                .thenReturn(List.of(draft, submitted));
        when(jobOfferRepository.findAllById(List.of(OFFER_ID)))
                .thenReturn(List.of(offer(JobOfferStatus.PUBLISHED, null)));
        stubQuestions(List.of(text, single), List.of(preferred));
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(draft.getId(), submitted.getId())))
                .thenReturn(List.of(textAnswer, singleAnswer));
        when(applicationAnswerOptionRepository.findByApplicationAnswerIdIn(List.of(textAnswer.getId(),
                singleAnswer.getId()))).thenReturn(List.of(selection));
        when(attachmentRepository.findAllById(List.of(CV_ID))).thenReturn(List.of(attachment("pinned.pdf")));

        List<ApplicationResponse> responses = applicationService.listMine(USER_ID);

        assertThat(responses).extracting(ApplicationResponse::status).containsExactly("draft", "submitted");
        assertThat(responses.get(0).cv()).isNull();
        assertThat(responses.get(0).answers()).isEmpty();
        ApplicationResponse response = responses.get(1);
        assertThat(response.cv().originalName()).isEqualTo("pinned.pdf");
        assertThat(response.answers().get(0).value()).isEqualTo("Hello");
        assertThat(response.answers().get(1).value())
                .isEqualTo(new ApplicationAnswerOptionView(preferred.getId(), "Yes"));
    }

    @Test
    void mesCandidaturesVidesNeChargentRienDautre() {
        when(applicationRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(USER_ID)).thenReturn(List.of());

        assertThat(applicationService.listMine(USER_ID)).isEmpty();

        verifyNoInteractions(jobOfferRepository, jobOfferQuestionRepository, jobOfferQuestionOptionRepository,
                applicationAnswerRepository, applicationAnswerOptionRepository, attachmentRepository);
    }

    @Test
    void retraitSeulementDepuisTransmise() {
        Application submitted = application(ApplicationStatus.SUBMITTED, CV_ID);
        stubOwned(submitted);
        applicationService.withdraw(USER_ID, submitted.getId());
        assertThat(submitted.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        verify(applicationRepository).save(submitted);

        for (ApplicationStatus status : List.of(ApplicationStatus.DRAFT, ApplicationStatus.ACCEPTED,
                ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN)) {
            Application other = application(status, CV_ID);
            stubOwned(other);
            assertStatus(() -> applicationService.withdraw(USER_ID, other.getId()), HttpStatus.CONFLICT);
            assertThat(other.getStatus()).isEqualTo(status);
        }

        UUID unknownId = UUID.randomUUID();
        when(applicationRepository.findByIdAndCandidateIdForUpdate(unknownId, USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> applicationService.withdraw(USER_ID, unknownId))
                .isInstanceOf(ApplicationNotFoundException.class);
    }

    // --- Outils ------------------------------------------------------------

    private void assertDraftBadRequest(List<ApplicationAnswerRequest> answers) {
        assertStatus(() -> applicationService.saveDraft(USER_ID, draft(answers)), HttpStatus.BAD_REQUEST);
    }

    private void assertDraftOfferUnavailable(JobOffer offer) {
        when(jobOfferRepository.findByPublicId(PUBLIC_ID)).thenReturn(Optional.ofNullable(offer));
        assertStatus(() -> applicationService.saveDraft(USER_ID, draft(List.of())), HttpStatus.NOT_FOUND);
    }

    private static void assertStatus(Runnable call, HttpStatus expected) {
        assertThatThrownBy(call::run)
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus()).isEqualTo(expected));
    }

    private static SaveApplicationDraftRequest draft(List<ApplicationAnswerRequest> answers) {
        return new SaveApplicationDraftRequest(PUBLIC_ID, answers);
    }

    private void stubOpenOffer() {
        when(jobOfferRepository.findByPublicId(PUBLIC_ID)).thenReturn(Optional.of(offer(JobOfferStatus.PUBLISHED,
                null)));
        stubCompany();
    }

    private void stubOfferById(JobOffer offer) {
        when(jobOfferRepository.findById(OFFER_ID)).thenReturn(Optional.of(offer));
        stubCompany();
    }

    private void stubCompany() {
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(Company.builder()
                .id(COMPANY_ID)
                .name("Acme")
                .build()));
    }

    private void stubCurrentCv(String name) {
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(CV_ID));
        when(attachmentRepository.findByIdAndCandidateId(CV_ID, USER_ID)).thenReturn(Optional.of(attachment(name)));
    }

    private void stubQuestions(List<JobOfferQuestion> questions, List<JobOfferQuestionOption> options) {
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(questions);
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(anyList()))
                .thenReturn(options);
    }

    private void stubCurrentMatching(Matching matching) {
        NormalizedProfile profile = NormalizedProfile.builder()
                .id(matching.getCandidateNormalizedProfileId())
                .version(1)
                .schemaVersion("3")
                .content("{}")
                .validatedAt(LocalDateTime.now())
                .build();
        when(normalizedProfileRepository.findLatestWithContentByCandidateId(USER_ID, PageRequest.of(0, 1)))
                .thenReturn(List.of(profile));
        when(matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(
                USER_ID, OFFER_ID, profile.getId())).thenReturn(Optional.of(matching));
        when(matchingRepository.findById(matching.getId())).thenReturn(Optional.of(matching));
    }

    private static Matching matching(LocalDateTime assessmentFinishedAt) {
        return Matching.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .candidateNormalizedProfileId(UUID.randomUUID())
                .assessmentFinishedAt(assessmentFinishedAt)
                .build();
    }

    private void stubOwned(Application application) {
        when(applicationRepository.findByIdAndCandidateId(application.getId(), USER_ID))
                .thenReturn(Optional.of(application));
        when(applicationRepository.findByIdAndCandidateIdForUpdate(application.getId(), USER_ID))
                .thenReturn(Optional.of(application));
    }

    private static Application application(ApplicationStatus status, UUID cvId) {
        return Application.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .cvAttachmentId(cvId)
                .status(status)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private JobOffer offer(JobOfferStatus status, LocalDate expiresAt) {
        return JobOffer.builder()
                .id(OFFER_ID)
                .companyId(COMPANY_ID)
                .recruiterId(UUID.randomUUID())
                .status(status)
                .title("Backend Engineer")
                .publicId(PUBLIC_ID)
                .slug("backend-engineer")
                .expiresAt(expiresAt)
                .build();
    }

    private JobOfferQuestion question(int idSeed, QuestionType type, boolean required, int sortOrder) {
        return JobOfferQuestion.builder()
                .id(new UUID(0, idSeed))
                .jobOfferId(OFFER_ID)
                .label("Question " + idSeed)
                .questionType(type)
                .isRequired(required)
                .sortOrder(sortOrder)
                .build();
    }

    private JobOfferQuestionOption option(int idSeed, UUID questionId, String label) {
        return JobOfferQuestionOption.builder()
                .id(new UUID(0, idSeed))
                .questionId(questionId)
                .label(label)
                .sortOrder(0)
                .preferred(false)
                .build();
    }

    private static ApplicationAnswer textAnswer(UUID applicationId, UUID questionId, String text) {
        return ApplicationAnswer.builder()
                .id(UUID.randomUUID())
                .applicationId(applicationId)
                .jobOfferId(OFFER_ID)
                .questionId(questionId)
                .answerText(text)
                .build();
    }

    private ApplicationAnswerRequest answer(UUID questionId, String text, BigDecimal number, Boolean booleanValue,
            List<UUID> optionIds) {
        return new ApplicationAnswerRequest(questionId, text, number, booleanValue, optionIds);
    }

    private Attachment attachment(String originalName) {
        return attachmentWithId(CV_ID, originalName);
    }

    private static Attachment attachmentWithId(UUID id, String originalName) {
        return Attachment.builder()
                .id(id)
                .candidateId(USER_ID)
                .originalName(originalName)
                .mimeType("application/pdf")
                .sizeBytes(10L)
                .sha256("ab".repeat(32))
                .storagePath("candidates/x/y")
                .build();
    }
}
