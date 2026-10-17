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

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;

import com.linqorbit.application.dto.ApplicationAnswerOptionView;
import com.linqorbit.application.dto.ApplicationAnswerRequest;
import com.linqorbit.application.dto.ApplicationAnswerView;
import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationResponse;
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

    private final ApplicationService applicationService = new ApplicationService(applicationRepository,
            applicationAnswerRepository, applicationAnswerOptionRepository, jobOfferRepository,
            jobOfferQuestionRepository, jobOfferQuestionOptionRepository, attachmentRepository, companyRepository,
            candidateService);

    @Test
    void soumissionNominaleInsereParEtagesEtReconstruitLesReponsesDansLOrdreDesQuestions() {
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
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(CV_ID));
        when(attachmentRepository.findByIdAndCandidateId(CV_ID, USER_ID))
                .thenReturn(Optional.of(attachment("my cv.pdf")));
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of(text, single, multiple, yesNo, number));
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(anyList()))
                .thenReturn(List.of(singleA, singleB, multipleA, multipleB));

        // Réponses volontairement dans le désordre : la sortie suit l'ordre des questions.
        SubmitApplicationRequest request = new SubmitApplicationRequest(PUBLIC_ID, null, List.of(
                new ApplicationAnswerRequest(number.getId(), null, new BigDecimal("42.50"), null, null),
                new ApplicationAnswerRequest(multiple.getId(), null, null, null, List.of(multipleB.getId(),
                        multipleA.getId(), multipleA.getId())),
                new ApplicationAnswerRequest(text.getId(), "  Backend fan  ", null, null, null),
                new ApplicationAnswerRequest(single.getId(), null, null, null, List.of(singleB.getId())),
                new ApplicationAnswerRequest(yesNo.getId(), null, null, true, null)));

        ApplicationResponse response = applicationService.submit(USER_ID, request);

        ArgumentCaptor<Application> applicationCaptor = ArgumentCaptor.forClass(Application.class);
        ArgumentCaptor<List<ApplicationAnswer>> answersCaptor = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<ApplicationAnswerOption>> selectionsCaptor = ArgumentCaptor.forClass(List.class);
        InOrder stages = inOrder(applicationRepository, applicationAnswerRepository,
                applicationAnswerOptionRepository);
        stages.verify(applicationRepository).saveAndFlush(applicationCaptor.capture());
        stages.verify(applicationAnswerRepository).saveAllAndFlush(answersCaptor.capture());
        stages.verify(applicationAnswerOptionRepository).saveAllAndFlush(selectionsCaptor.capture());

        Application application = applicationCaptor.getValue();
        assertThat(application.getCandidateId()).isEqualTo(USER_ID);
        assertThat(application.getJobOfferId()).isEqualTo(OFFER_ID);
        assertThat(application.getCvAttachmentId()).isEqualTo(CV_ID);
        assertThat(application.getMatchingId()).isNull();
        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.SUBMITTED);

        List<ApplicationAnswer> answers = answersCaptor.getValue();
        assertThat(answers).hasSize(5);
        assertThat(answers).extracting(ApplicationAnswer::getQuestionId).containsExactly(text.getId(), single.getId(),
                multiple.getId(), yesNo.getId(), number.getId());
        ApplicationAnswer textRow = answers.get(0);
        assertThat(textRow.getApplicationId()).isEqualTo(application.getId());
        assertThat(textRow.getJobOfferId()).isEqualTo(OFFER_ID);
        assertThat(textRow.getAnswerText()).isEqualTo("Backend fan");
        assertThat(textRow.getAnswerNumber()).isNull();
        assertThat(textRow.getAnswerBoolean()).isNull();
        assertThat(answers.get(4).getAnswerNumber()).isEqualByComparingTo("42.50");

        List<ApplicationAnswerOption> selections = selectionsCaptor.getValue();
        // QCS (1 sélection) + QCM (dédupliqué, ordre du client conservé) = 3 lignes.
        assertThat(selections).hasSize(3);
        assertThat(selections).extracting(ApplicationAnswerOption::getOptionId).containsExactly(singleB.getId(),
                multipleB.getId(), multipleA.getId());
        assertThat(selections).extracting(ApplicationAnswerOption::getQuestionId).containsExactly(single.getId(),
                multiple.getId(), multiple.getId());

        assertThat(response.id()).isEqualTo(application.getId());
        assertThat(response.status()).isEqualTo("submitted");
        assertThat(response.job().publicId()).isEqualTo(PUBLIC_ID);
        assertThat(response.job().title()).isEqualTo("Backend Engineer");
        assertThat(response.job().companyName()).isEqualTo("Acme");
        assertThat(response.cv().attachmentId()).isEqualTo(CV_ID);
        assertThat(response.cv().originalName()).isEqualTo("my cv.pdf");
        assertThat(response.answers()).extracting(ApplicationAnswerView::questionId)
                .containsExactly(text.getId(), single.getId(), multiple.getId(), yesNo.getId(), number.getId());
        assertThat(response.answers().get(0).value()).isEqualTo("Backend fan");
        assertThat(response.answers().get(1).value())
                .isEqualTo(new ApplicationAnswerOptionView(singleB.getId(), "On site"));
        assertThat(response.answers().get(2).value()).isEqualTo(List.of(
                new ApplicationAnswerOptionView(multipleB.getId(), "Spring"),
                new ApplicationAnswerOptionView(multipleA.getId(), "Java")));
        assertThat(response.answers().get(3).value()).isEqualTo(Boolean.TRUE);
        assertThat((BigDecimal) response.answers().get(4).value()).isEqualByComparingTo("42.50");
    }

    @Test
    void soumissionUtiliseLeCvCourantQuandAucunCvNestChoisi() {
        stubOpenOffer();
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(CV_ID));
        when(attachmentRepository.findByIdAndCandidateId(CV_ID, USER_ID))
                .thenReturn(Optional.of(attachment("current.pdf")));
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of());

        ApplicationResponse response = applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, null, null));

        assertThat(response.cv().originalName()).isEqualTo("current.pdf");
        ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
        verify(applicationRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getCvAttachmentId()).isEqualTo(CV_ID);
    }

    @Test
    void soumissionRejetteUnCvInconnuEtUnCandidatSansCv() {
        stubOpenOffer();

        assertThatThrownBy(() -> applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, UUID.randomUUID(), List.of())))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));

        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, null, List.of())))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));

        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void soumissionRejetteUneOffreInconnueNonPublieeOuExpiree() {
        assertOfferUnavailable(null, HttpStatus.NOT_FOUND);
        assertOfferUnavailable(offer(JobOfferStatus.DRAFT, null), HttpStatus.NOT_FOUND);
        assertOfferUnavailable(offer(JobOfferStatus.PUBLISHED, LocalDate.now().minusDays(1)), HttpStatus.NOT_FOUND);

        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void soumissionRejetteLeDoublonDeCoupleYComprisApresRetrait() {
        stubOpenOffer();
        when(applicationRepository.existsByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(true);

        assertThatThrownBy(() -> applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, null, List.of())))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));

        verifyNoInteractions(attachmentRepository);
        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void soumissionRejetteLesReponsesInvalidesEtLesObligatoiresManquantes() {
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
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(CV_ID));
        when(attachmentRepository.findByIdAndCandidateId(CV_ID, USER_ID))
                .thenReturn(Optional.of(attachment("cv.pdf")));
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of(text, single, multiple, yesNo, number));
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(anyList()))
                .thenReturn(List.of(singleA, multipleA));

        assertBadRequest(List.of()); // obligatoire non répondue
        assertBadRequest(List.of(answer(foreignQuestionId, "x", null, null, null))); // question inconnue
        assertBadRequest(List.of(answer(text.getId(), "  ", null, null, null))); // texte vide
        assertBadRequest(List.of(answer(text.getId(), "ok", null, null, List.of(singleA.getId())))); // texte + option
        assertBadRequest(List.of(answer(text.getId(), null, new BigDecimal("10.999"), null, null))); // 3 décimales
        assertBadRequest(List.of(answer(text.getId(), null, new BigDecimal("10000000000.00"), null, null))); // > 12,2
        assertBadRequest(List.of(answer(yesNo.getId(), null, null, null, null))); // oui/non sans valeur
        assertBadRequest(List.of(answer(yesNo.getId(), null, new BigDecimal("1"), true, null))); // deux porteurs
        assertBadRequest(List.of(answer(single.getId(), null, null, null, List.of()))); // QCS sans option
        assertBadRequest(List.of(answer(single.getId(), null, null, null,
                List.of(singleA.getId(), multipleA.getId())))); // QCS à 2 options
        assertBadRequest(List.of(answer(single.getId(), null, null, null, List.of(foreignOptionId))));
        // option d'une question étrangère
        assertBadRequest(List.of(answer(multiple.getId(), null, null, null, List.of()))); // QCM vide
        assertBadRequest(List.of(answer(multiple.getId(), null, null, null, List.of(foreignOptionId))));
        // option étrangère
        assertBadRequest(List.of(answer(text.getId(), "ok", null, null, null),
                answer(text.getId(), null, new BigDecimal("1"), null, null))); // doublon de question

        verify(applicationRepository, never()).saveAndFlush(any());
        verify(applicationAnswerRepository, never()).saveAllAndFlush(anyList());
    }

    @Test
    void contexteExposeLesQuestionsSansPreferredEtLaCandidatureExistante() {
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
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of(text, choice));
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(anyList()))
                .thenReturn(List.of(preferred));
        when(candidateService.getCurrentCvAttachmentId(USER_ID)).thenReturn(Optional.of(CV_ID));
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID)).thenReturn(Optional.empty());

        ApplicationContextResponse context = applicationService.getContext(USER_ID, PUBLIC_ID);

        assertThat(context.job().title()).isEqualTo("Backend Engineer");
        assertThat(context.job().companyName()).isEqualTo("Acme");
        assertThat(context.questions()).extracting(question -> question.id())
                .containsExactly(text.getId(), choice.getId());
        assertThat(context.questions().get(1).type()).isEqualTo("single_choice");
        assertThat(context.questions().get(1).isRequired()).isTrue();
        assertThat(context.questions().get(1).options()).extracting(option -> option.label())
                .containsExactly("Ideal");
        assertThat(context.currentCvAttachmentId()).isEqualTo(CV_ID);
        assertThat(context.existingApplication()).isNull();

        Application existing = Application.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .cvAttachmentId(CV_ID)
                .status(ApplicationStatus.WITHDRAWN)
                .createdAt(LocalDateTime.now())
                .build();
        when(applicationRepository.findByCandidateIdAndJobOfferId(USER_ID, OFFER_ID))
                .thenReturn(Optional.of(existing));
        ApplicationContextResponse withExisting = applicationService.getContext(USER_ID, PUBLIC_ID);
        assertThat(withExisting.existingApplication().id()).isEqualTo(existing.getId());
        assertThat(withExisting.existingApplication().status()).isEqualTo("withdrawn");
    }

    @Test
    void mesCandidaturesReconstruisentLesValeursSansPreferred() {
        Application application = Application.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .cvAttachmentId(CV_ID)
                .status(ApplicationStatus.SUBMITTED)
                .createdAt(LocalDateTime.now())
                .build();
        JobOfferQuestion text = question(1, QuestionType.TEXT, true, 0);
        JobOfferQuestion single = question(2, QuestionType.SINGLE_CHOICE, true, 1);
        JobOfferQuestionOption preferred = JobOfferQuestionOption.builder()
                .id(option(11, single.getId(), "Yes").getId())
                .questionId(single.getId())
                .label("Yes")
                .sortOrder(0)
                .preferred(true)
                .build();
        ApplicationAnswer textAnswer = ApplicationAnswer.builder()
                .id(UUID.randomUUID())
                .applicationId(application.getId())
                .jobOfferId(OFFER_ID)
                .questionId(text.getId())
                .answerText("Hello")
                .build();
        ApplicationAnswer singleAnswer = ApplicationAnswer.builder()
                .id(UUID.randomUUID())
                .applicationId(application.getId())
                .jobOfferId(OFFER_ID)
                .questionId(single.getId())
                .build();
        ApplicationAnswerOption selection = ApplicationAnswerOption.builder()
                .applicationAnswerId(singleAnswer.getId())
                .questionId(single.getId())
                .optionId(preferred.getId())
                .build();

        when(applicationRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(USER_ID))
                .thenReturn(List.of(application));
        when(jobOfferRepository.findAllById(List.of(OFFER_ID))).thenReturn(List.of(offer(JobOfferStatus.PUBLISHED,
                null)));
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of(text, single));
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(anyList()))
                .thenReturn(List.of(preferred));
        when(applicationAnswerRepository.findByApplicationIdIn(List.of(application.getId())))
                .thenReturn(List.of(textAnswer, singleAnswer));
        when(applicationAnswerOptionRepository.findByApplicationAnswerIdIn(List.of(textAnswer.getId(),
                singleAnswer.getId()))).thenReturn(List.of(selection));
        when(attachmentRepository.findAllById(List.of(CV_ID))).thenReturn(List.of(attachment("pinned.pdf")));

        List<ApplicationResponse> responses = applicationService.listMine(USER_ID);

        assertThat(responses).hasSize(1);
        ApplicationResponse response = responses.get(0);
        assertThat(response.status()).isEqualTo("submitted");
        assertThat(response.cv().originalName()).isEqualTo("pinned.pdf");
        assertThat(response.answers()).extracting(ApplicationAnswerView::questionId)
                .containsExactly(text.getId(), single.getId());
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
    void retraitSeulementDepuisSoumise() {
        Application submitted = Application.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .cvAttachmentId(CV_ID)
                .status(ApplicationStatus.SUBMITTED)
                .build();
        when(applicationRepository.findByIdAndCandidateId(submitted.getId(), USER_ID))
                .thenReturn(Optional.of(submitted));

        applicationService.withdraw(USER_ID, submitted.getId());

        assertThat(submitted.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        verify(applicationRepository).save(submitted);

        Application accepted = Application.builder()
                .id(UUID.randomUUID())
                .candidateId(USER_ID)
                .jobOfferId(OFFER_ID)
                .cvAttachmentId(CV_ID)
                .status(ApplicationStatus.ACCEPTED)
                .build();
        when(applicationRepository.findByIdAndCandidateId(accepted.getId(), USER_ID))
                .thenReturn(Optional.of(accepted));

        assertThatThrownBy(() -> applicationService.withdraw(USER_ID, accepted.getId()))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);

        UUID unknownId = UUID.randomUUID();
        when(applicationRepository.findByIdAndCandidateId(unknownId, USER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> applicationService.withdraw(USER_ID, unknownId))
                .isInstanceOf(ApplicationNotFoundException.class);
    }

    private void assertBadRequest(List<ApplicationAnswerRequest> answers) {
        assertThatThrownBy(() -> applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, null, answers)))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    private void assertOfferUnavailable(JobOffer offer, HttpStatus expected) {
        when(jobOfferRepository.findByPublicId(PUBLIC_ID)).thenReturn(Optional.ofNullable(offer));
        assertThatThrownBy(() -> applicationService.submit(USER_ID,
                new SubmitApplicationRequest(PUBLIC_ID, null, List.of())))
                .isInstanceOf(InvalidApplicationException.class)
                .satisfies(ex -> assertThat(((InvalidApplicationException) ex).getStatus()).isEqualTo(expected));
    }

    private void stubOpenOffer() {
        when(jobOfferRepository.findByPublicId(PUBLIC_ID))
                .thenReturn(Optional.of(offer(JobOfferStatus.PUBLISHED, null)));
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(Company.builder()
                .id(COMPANY_ID)
                .name("Acme")
                .build()));
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

    private ApplicationAnswerRequest answer(UUID questionId, String text, BigDecimal number, Boolean booleanValue,
            List<UUID> optionIds) {
        return new ApplicationAnswerRequest(questionId, text, number, booleanValue, optionIds);
    }

    private Attachment attachment(String originalName) {
        return Attachment.builder()
                .id(CV_ID)
                .candidateId(USER_ID)
                .originalName(originalName)
                .mimeType("application/pdf")
                .sizeBytes(10L)
                .sha256("ab".repeat(32))
                .storagePath("candidates/x/y")
                .build();
    }
}
