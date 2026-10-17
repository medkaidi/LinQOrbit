package com.linqorbit.application.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import com.linqorbit.application.dto.ApplicationAnswerOptionView;
import com.linqorbit.application.dto.ApplicationAnswerRequest;
import com.linqorbit.application.dto.ApplicationAnswerView;
import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationCvSummary;
import com.linqorbit.application.dto.ApplicationJobSummary;
import com.linqorbit.application.dto.ApplicationQuestionOptionView;
import com.linqorbit.application.dto.ApplicationQuestionView;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.ApplicationSummary;
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

/**
 * Candidatures (D48–D49) : soumission atomique d'une candidature à une offre
 * publiée et non expirée, contexte du formulaire de candidature, liste « mes
 * candidatures » (réponses reconstruites) et retrait (SUBMITTED → WITHDRAWN,
 * terminal au MVP).
 *
 * <p>Soumission : le CV (choisi ou courant, sinon 409) est épinglé, les
 * questions obligatoires doivent être répondues et chaque réponse doit
 * respecter le type de sa question (cardinalité des choix contrôlée en
 * service — la base ne lit pas {@code question_type}). L'insertion procède
 * par étages ({@code saveAndFlush} application → réponses → sélections) :
 * contraintes IMMEDIATE, l'ordre Hibernate n'est pas garanti entre types
 * d'entités (D56). {@code matching_id} reste NULL tant que le moteur de
 * matching n'existe pas — jamais accepté du client.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private static final String OFFER_UNAVAILABLE = "This job offer is no longer available.";
    private static final BigDecimal STORABLE_NUMBER_LIMIT = new BigDecimal("10000000000");

    private final ApplicationRepository applicationRepository;
    private final ApplicationAnswerRepository applicationAnswerRepository;
    private final ApplicationAnswerOptionRepository applicationAnswerOptionRepository;
    private final JobOfferRepository jobOfferRepository;
    private final JobOfferQuestionRepository jobOfferQuestionRepository;
    private final JobOfferQuestionOptionRepository jobOfferQuestionOptionRepository;
    private final AttachmentRepository attachmentRepository;
    private final CompanyRepository companyRepository;
    private final CandidateService candidateService;

    @Transactional
    public ApplicationResponse submit(UUID userId, SubmitApplicationRequest request) {
        log.info("Application submit requested : userId={}, jobPublicId={}", userId, request.jobPublicId());
        JobOffer offer = loadOpenOffer(request.jobPublicId());
        if (applicationRepository.existsByCandidateIdAndJobOfferId(userId, offer.getId())) {
            log.warn("Application submit rejected : already applied, userId={}, offerId={}",
                    userId, offer.getId());
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "You have already applied to this job offer.");
        }
        Attachment cv = resolveCv(userId, request.cvAttachmentId());
        List<JobOfferQuestion> questions = jobOfferQuestionRepository
                .findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(offer.getId()));
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(questions);
        List<ValidatedAnswer> answers = validateAnswers(questions, optionsByQuestion, request.answers());

        UUID applicationId = UUID.randomUUID();
        Application application = Application.builder()
                .id(applicationId)
                .candidateId(userId)
                .jobOfferId(offer.getId())
                .cvAttachmentId(cv.getId())
                .matchingId(null)
                .status(ApplicationStatus.SUBMITTED)
                .build();
        applicationRepository.saveAndFlush(application);

        List<ApplicationAnswer> answerRows = new ArrayList<>(answers.size());
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = new LinkedHashMap<>();
        for (ValidatedAnswer answer : answers) {
            UUID answerId = UUID.randomUUID();
            answerRows.add(ApplicationAnswer.builder()
                    .id(answerId)
                    .applicationId(applicationId)
                    .jobOfferId(offer.getId())
                    .questionId(answer.question().getId())
                    .answerText(answer.text())
                    .answerNumber(answer.number())
                    .answerBoolean(answer.booleanValue())
                    .build());
            if (!answer.optionIds().isEmpty()) {
                selectionsByAnswer.put(answerId, answer.optionIds().stream()
                        .map(optionId -> ApplicationAnswerOption.builder()
                                .applicationAnswerId(answerId)
                                .questionId(answer.question().getId())
                                .optionId(optionId)
                                .build())
                        .toList());
            }
        }
        if (!answerRows.isEmpty()) {
            applicationAnswerRepository.saveAllAndFlush(answerRows);
        }
        List<ApplicationAnswerOption> selectionRows = selectionsByAnswer.values().stream()
                .flatMap(List::stream).toList();
        if (!selectionRows.isEmpty()) {
            applicationAnswerOptionRepository.saveAllAndFlush(selectionRows);
        }

        List<ApplicationAnswerView> answerViews = buildAnswerViews(questions, answerRows, selectionsByAnswer,
                labelsOf(optionsByQuestion));
        log.info("Application submitted : userId={}, applicationId={}, offerId={}, answers={}",
                userId, applicationId, offer.getId(), answerRows.size());
        return new ApplicationResponse(applicationId, ApplicationStatus.SUBMITTED.getApiValue(),
                application.getCreatedAt(), application.getUpdatedAt(), jobSummary(offer),
                new ApplicationCvSummary(cv.getId(), cv.getOriginalName()), answerViews);
    }

    /**
     * Contexte du formulaire de candidature : l'offre doit être publiée et non
     * expirée (même 404 sûr que la lecture publique), les questions sortent
     * sans {@code preferred} (information recruteur seule).
     */
    @Transactional(readOnly = true)
    public ApplicationContextResponse getContext(UUID userId, String jobPublicId) {
        log.info("Application context requested : userId={}, jobPublicId={}", userId, jobPublicId);
        JobOffer offer = loadOpenOffer(jobPublicId);
        List<JobOfferQuestion> questions = jobOfferQuestionRepository
                .findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(offer.getId()));
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(questions);
        List<ApplicationQuestionView> questionViews = questions.stream()
                .map(question -> new ApplicationQuestionView(question.getId(), question.getLabel(),
                        question.getQuestionType().getApiValue(), Boolean.TRUE.equals(question.getIsRequired()),
                        question.getSortOrder(), optionsByQuestion.getOrDefault(question.getId(), List.of()).stream()
                                .map(option -> new ApplicationQuestionOptionView(option.getId(), option.getLabel(),
                                        option.getSortOrder()))
                                .toList()))
                .toList();
        ApplicationSummary existing = applicationRepository
                .findByCandidateIdAndJobOfferId(userId, offer.getId())
                .map(application -> new ApplicationSummary(application.getId(),
                        application.getStatus().getApiValue(), application.getCreatedAt()))
                .orElse(null);
        UUID currentCvAttachmentId = candidateService.getCurrentCvAttachmentId(userId).orElse(null);
        log.info("Application context served : userId={}, offerId={}, questions={}, alreadyApplied={}",
                userId, offer.getId(), questionViews.size(), existing != null);
        return new ApplicationContextResponse(jobSummary(offer), questionViews, currentCvAttachmentId, existing);
    }

    /**
     * « Mes candidatures » : candidatures du candidat connecté, plus récentes
     * d'abord, réponses reconstruites dans l'ordre des questions de l'offre.
     */
    @Transactional(readOnly = true)
    public List<ApplicationResponse> listMine(UUID userId) {
        log.info("Applications list requested : userId={}", userId);
        List<Application> applications = applicationRepository
                .findByCandidateIdOrderByCreatedAtDescIdDesc(userId);
        if (applications.isEmpty()) {
            log.info("Applications list served : userId={}, count=0", userId);
            return List.of();
        }
        List<UUID> offerIds = applications.stream().map(Application::getJobOfferId).distinct().toList();
        Map<UUID, JobOffer> offersById = new HashMap<>();
        jobOfferRepository.findAllById(offerIds).forEach(offer -> offersById.put(offer.getId(), offer));
        Map<UUID, List<JobOfferQuestion>> questionsByOffer = new HashMap<>();
        jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(offerIds).forEach(question ->
                questionsByOffer.computeIfAbsent(question.getJobOfferId(), key -> new ArrayList<>()).add(question));
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(
                questionsByOffer.values().stream().flatMap(List::stream).toList());
        Map<UUID, String> optionLabels = labelsOf(optionsByQuestion);
        List<ApplicationAnswer> answerRows = applicationAnswerRepository
                .findByApplicationIdIn(applications.stream().map(Application::getId).toList());
        Map<UUID, List<ApplicationAnswer>> answersByApplication = new HashMap<>();
        answerRows.forEach(answer -> answersByApplication
                .computeIfAbsent(answer.getApplicationId(), key -> new ArrayList<>()).add(answer));
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = new HashMap<>();
        if (!answerRows.isEmpty()) {
            applicationAnswerOptionRepository
                    .findByApplicationAnswerIdIn(answerRows.stream().map(ApplicationAnswer::getId).toList())
                    .forEach(selection -> selectionsByAnswer
                            .computeIfAbsent(selection.getApplicationAnswerId(), key -> new ArrayList<>())
                            .add(selection));
        }
        Map<UUID, Attachment> attachmentsById = new HashMap<>();
        attachmentRepository.findAllById(applications.stream().map(Application::getCvAttachmentId).toList())
                .forEach(attachment -> attachmentsById.put(attachment.getId(), attachment));

        List<ApplicationResponse> responses = new ArrayList<>(applications.size());
        for (Application application : applications) {
            JobOffer offer = offersById.get(application.getJobOfferId());
            // Les questions d'une offre publiée sont figées : chaque réponse
            // retrouve sa question, servie dans l'ordre du formulaire.
            List<JobOfferQuestion> questions = questionsByOffer.getOrDefault(offer.getId(), List.of());
            Map<UUID, ApplicationAnswer> answersByQuestion = new HashMap<>();
            answersByApplication.getOrDefault(application.getId(), List.of())
                    .forEach(answer -> answersByQuestion.put(answer.getQuestionId(), answer));
            List<ApplicationAnswerView> answerViews = questions.stream()
                    .filter(question -> answersByQuestion.containsKey(question.getId()))
                    .map(question -> {
                        ApplicationAnswer answer = answersByQuestion.get(question.getId());
                        return toAnswerView(question, answer,
                                selectionsByAnswer.getOrDefault(answer.getId(), List.of()), optionLabels);
                    })
                    .toList();
            Attachment cv = attachmentsById.get(application.getCvAttachmentId());
            responses.add(new ApplicationResponse(application.getId(), application.getStatus().getApiValue(),
                    application.getCreatedAt(), application.getUpdatedAt(), jobSummary(offer),
                    new ApplicationCvSummary(application.getCvAttachmentId(),
                            cv == null ? null : cv.getOriginalName()),
                    answerViews));
        }
        log.info("Applications list served : userId={}, count={}", userId, responses.size());
        return responses;
    }

    /**
     * Retrait (D49) : uniquement depuis SUBMITTED — WITHDRAWN est terminal au
     * MVP (l'UNIQUE du couple interdit la repostulation).
     */
    @Transactional
    public void withdraw(UUID userId, UUID applicationId) {
        log.info("Application withdraw requested : userId={}, applicationId={}", userId, applicationId);
        Application application = applicationRepository.findByIdAndCandidateId(applicationId, userId)
                .orElseThrow(() -> {
                    log.warn("Application withdraw rejected : unknown application or not owner, userId={},"
                            + " applicationId={}", userId, applicationId);
                    return new ApplicationNotFoundException(
                            "application " + applicationId + " not found for candidate " + userId);
                });
        if (application.getStatus() != ApplicationStatus.SUBMITTED) {
            log.warn("Application withdraw rejected : applicationId={}, status={}",
                    applicationId, application.getStatus().getApiValue());
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "This application can no longer be withdrawn.");
        }
        application.setStatus(ApplicationStatus.WITHDRAWN);
        applicationRepository.save(application);
        log.info("Application withdrawn : userId={}, applicationId={}", userId, applicationId);
    }

    /**
     * Offre cible : PUBLISHED et non expirée, sinon le même 404 sûr que la
     * lecture publique (détail unique — pas d'énumération des offres).
     */
    private JobOffer loadOpenOffer(String publicId) {
        JobOffer offer = jobOfferRepository.findByPublicId(publicId)
                .orElseThrow(() -> {
                    log.warn("Application offer rejected : unknown publicId={}", publicId);
                    return new InvalidApplicationException(HttpStatus.NOT_FOUND, OFFER_UNAVAILABLE);
                });
        if (offer.getStatus() != JobOfferStatus.PUBLISHED
                || (offer.getExpiresAt() != null && offer.getExpiresAt().isBefore(LocalDate.now()))) {
            log.warn("Application offer rejected : publicId={}, status={}, expiresAt={}",
                    publicId, offer.getStatus().getApiValue(), offer.getExpiresAt());
            throw new InvalidApplicationException(HttpStatus.NOT_FOUND, OFFER_UNAVAILABLE);
        }
        return offer;
    }

    /**
     * CV de la candidature : l'identifiant demandé doit appartenir au
     * candidat (400 sinon — les anciens CV restent candidats au choix) ;
     * absent, le CV courant est épinglé ; sans CV du tout, 409 (D46).
     */
    private Attachment resolveCv(UUID userId, UUID requestedId) {
        if (requestedId != null) {
            return attachmentRepository.findByIdAndCandidateId(requestedId, userId)
                    .orElseThrow(() -> {
                        log.warn("Application submit rejected : unknown CV or not owner, userId={},"
                                + " attachmentId={}", userId, requestedId);
                        return new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                                "The selected CV is not available.");
                    });
        }
        UUID currentId = candidateService.getCurrentCvAttachmentId(userId).orElse(null);
        if (currentId != null) {
            Attachment current = attachmentRepository.findByIdAndCandidateId(currentId, userId).orElse(null);
            if (current != null) {
                return current;
            }
        }
        log.warn("Application submit rejected : no CV, userId={}", userId);
        throw new InvalidApplicationException(HttpStatus.CONFLICT,
                "A CV is required to apply. Add one to your profile first.");
    }

    private Map<UUID, List<JobOfferQuestionOption>> loadOptionsByQuestion(List<JobOfferQuestion> questions) {
        List<UUID> choiceQuestionIds = questions.stream()
                .filter(question -> question.getQuestionType().isChoice())
                .map(JobOfferQuestion::getId)
                .toList();
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = new HashMap<>();
        if (!choiceQuestionIds.isEmpty()) {
            jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(choiceQuestionIds)
                    .forEach(option -> optionsByQuestion
                            .computeIfAbsent(option.getQuestionId(), key -> new ArrayList<>())
                            .add(option));
        }
        return optionsByQuestion;
    }

    /**
     * Validation des réponses (D48) : question connue de l'offre, pas de
     * doublon, exactement un porteur adapté au type (cardinalité QCS = 1 /
     * QCM ≥ 1 contrôlée ici — la base ne lit pas question_type), options
     * appartenant à leur question (la chaîne FK les reverrouille en base), et
     * toutes les questions obligatoires répondues. Résultat trié dans l'ordre
     * des questions.
     */
    private List<ValidatedAnswer> validateAnswers(List<JobOfferQuestion> questions,
            Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion, List<ApplicationAnswerRequest> requests) {
        Map<UUID, JobOfferQuestion> questionsById = new LinkedHashMap<>();
        questions.forEach(question -> questionsById.put(question.getId(), question));
        Map<UUID, ValidatedAnswer> answersByQuestion = new HashMap<>();
        for (ApplicationAnswerRequest request : requests) {
            if (request.questionId() == null || !questionsById.containsKey(request.questionId())) {
                log.warn("Application submit rejected : answer for unknown question, questionId={}",
                        request.questionId());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "Unknown question in your submission.");
            }
            JobOfferQuestion question = questionsById.get(request.questionId());
            if (answersByQuestion.containsKey(question.getId())) {
                log.warn("Application submit rejected : duplicate answer, questionId={}", question.getId());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "Duplicate answer in your submission.");
            }
            List<UUID> optionIds = request.optionIds().stream().distinct().toList();
            int scalars = (request.text() != null ? 1 : 0) + (request.number() != null ? 1 : 0)
                    + (request.booleanValue() != null ? 1 : 0);
            QuestionType type = question.getQuestionType();
            Set<UUID> allowedOptions = new LinkedHashSet<>(optionsByQuestion
                    .getOrDefault(question.getId(), List.of()).stream()
                    .map(JobOfferQuestionOption::getId).toList());
            boolean valid = switch (type) {
                case TEXT -> scalars == 1 && request.text() != null && !request.text().isBlank()
                        && optionIds.isEmpty();
                case NUMBER -> scalars == 1 && request.number() != null && isStorableNumber(request.number())
                        && optionIds.isEmpty();
                case YES_NO -> scalars == 1 && request.booleanValue() != null && optionIds.isEmpty();
                case SINGLE_CHOICE -> scalars == 0 && optionIds.size() == 1 && allowedOptions.containsAll(optionIds);
                case MULTIPLE_CHOICE -> scalars == 0 && !optionIds.isEmpty() && allowedOptions.containsAll(optionIds);
            };
            if (!valid) {
                log.warn("Application submit rejected : invalid answer, questionId={}, type={}",
                        question.getId(), type.getApiValue());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "Answer for question '" + question.getLabel() + "' is invalid.");
            }
            answersByQuestion.put(question.getId(), new ValidatedAnswer(question,
                    request.text() == null ? null : request.text().trim(),
                    request.number(), request.booleanValue(), optionIds));
        }
        for (JobOfferQuestion question : questions) {
            if (Boolean.TRUE.equals(question.getIsRequired()) && !answersByQuestion.containsKey(question.getId())) {
                log.warn("Application submit rejected : required question unanswered, questionId={}",
                        question.getId());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "All required questions must be answered.");
            }
        }
        return questions.stream()
                .map(question -> answersByQuestion.get(question.getId()))
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * Valeur stockable en NUMERIC(12, 2) : au plus 2 décimales et une magnitude
     * sous 10^10 — PostgreSQL arrondirait silencieusement, on refuse (400)
     * plutôt que d'altérer la réponse.
     */
    private static boolean isStorableNumber(BigDecimal number) {
        BigDecimal normalized = number.stripTrailingZeros();
        return normalized.scale() <= 2 && normalized.abs().compareTo(STORABLE_NUMBER_LIMIT) < 0;
    }

    private ApplicationJobSummary jobSummary(JobOffer offer) {
        String companyName = companyRepository.findById(offer.getCompanyId())
                .map(Company::getName)
                .orElse(null);
        return new ApplicationJobSummary(offer.getPublicId(), offer.getSlug(), offer.getTitle(), companyName);
    }

    private static Map<UUID, String> labelsOf(Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion) {
        Map<UUID, String> labels = new HashMap<>();
        optionsByQuestion.values().forEach(options -> options.forEach(option -> labels.put(option.getId(),
                option.getLabel())));
        return labels;
    }

    private static List<ApplicationAnswerView> buildAnswerViews(List<JobOfferQuestion> questions,
            List<ApplicationAnswer> answerRows, Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer,
            Map<UUID, String> optionLabels) {
        Map<UUID, JobOfferQuestion> questionsById = new HashMap<>();
        questions.forEach(question -> questionsById.put(question.getId(), question));
        Map<UUID, ApplicationAnswer> rowsByQuestion = new HashMap<>();
        answerRows.forEach(answer -> rowsByQuestion.put(answer.getQuestionId(), answer));
        return questions.stream()
                .map(question -> rowsByQuestion.get(question.getId()))
                .filter(Objects::nonNull)
                .map(answer -> toAnswerView(questionsById.get(answer.getQuestionId()), answer,
                        selectionsByAnswer.getOrDefault(answer.getId(), List.of()), optionLabels))
                .toList();
    }

    private static ApplicationAnswerView toAnswerView(JobOfferQuestion question, ApplicationAnswer answer,
            List<ApplicationAnswerOption> selections, Map<UUID, String> optionLabels) {
        Object value = switch (question.getQuestionType()) {
            case TEXT -> answer.getAnswerText();
            case NUMBER -> answer.getAnswerNumber();
            case YES_NO -> answer.getAnswerBoolean();
            case SINGLE_CHOICE -> selections.stream().findFirst()
                    .map(selection -> toOptionView(selection, optionLabels))
                    .orElse(null);
            case MULTIPLE_CHOICE -> selections.stream()
                    .map(selection -> toOptionView(selection, optionLabels))
                    .toList();
        };
        return new ApplicationAnswerView(question.getId(), question.getLabel(),
                question.getQuestionType().getApiValue(), value);
    }

    private static ApplicationAnswerOptionView toOptionView(ApplicationAnswerOption selection,
            Map<UUID, String> optionLabels) {
        return new ApplicationAnswerOptionView(selection.getOptionId(), optionLabels.get(selection.getOptionId()));
    }

    /** Réponse validée : la question, la valeur scalaire ou les options retenues. */
    private record ValidatedAnswer(JobOfferQuestion question, String text, BigDecimal number, Boolean booleanValue,
            List<UUID> optionIds) {
    }
}
