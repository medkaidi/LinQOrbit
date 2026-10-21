package com.linqorbit.application.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import com.linqorbit.application.dto.ApplicationAnswerOptionView;
import com.linqorbit.application.dto.ApplicationAnswerRequest;
import com.linqorbit.application.dto.ApplicationAnswerView;
import com.linqorbit.application.dto.ApplicationAssessmentView;
import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationCvSummary;
import com.linqorbit.application.dto.ApplicationJobSummary;
import com.linqorbit.application.dto.ApplicationQuestionOptionView;
import com.linqorbit.application.dto.ApplicationQuestionView;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.ApplicationSummary;
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
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingRepository;

/**
 * Candidatures (D48–D49, révisées par D59) : parcours guidé en brouillon sur
 * une offre publiée et non expirée — enregistrement des réponses aux
 * questions du recruteur (brouillon créé au premier enregistrement, réponses
 * remplaçables tant que DRAFT), transmission (réponses figées, CV épinglé,
 * {@code matching_id} posé), abandon du brouillon, contexte du parcours avec
 * l'étape calculée, liste « mes candidatures » et retrait (SUBMITTED →
 * WITHDRAWN, terminal au MVP).
 *
 * <p>Réponses : chaque réponse doit respecter le type de sa question
 * (cardinalité des choix contrôlée en service — la base ne lit pas
 * {@code question_type}) ; les questions obligatoires ne sont exigées qu'à la
 * transmission et avant le matching (un brouillon peut être partiel).
 * L'insertion procède par étages ({@code saveAndFlush} application → réponses
 * → sélections) : contraintes IMMEDIATE, l'ordre Hibernate n'est pas garanti
 * entre types d'entités (D56). {@code matching_id} n'est jamais accepté du
 * client.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationService {

    private static final String OFFER_UNAVAILABLE = "This job offer is no longer available.";
    private static final String ALREADY_APPLIED = "You have already applied to this job offer.";
    static final String PROFILE_REQUIRED = "Complete your candidate profile before applying.";
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
    private final CandidateRepository candidateRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final MatchingRepository matchingRepository;
    private final MatchingCriterionFeedbackRepository feedbackRepository;

    /**
     * Enregistre le brouillon du couple : création au premier appel (CV
     * courant renseigné s'il existe), remplacement des réponses ensuite. Une
     * candidature déjà transmise ne se modifie plus (409).
     */
    @Transactional
    public ApplicationResponse saveDraft(UUID userId, SaveApplicationDraftRequest request) {
        log.info("Application draft save requested : userId={}, jobPublicId={}, answers={}",
                userId, request.jobPublicId(), request.answers().size());
        JobOffer offer = requireOpenOffer(request.jobPublicId());
        List<JobOfferQuestion> questions = questionsOf(offer.getId());
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(questions);
        List<ValidatedAnswer> answers = validateAnswers(questions, optionsByQuestion, request.answers());

        // TD-053 : verrou de la ligne candidat (motif de validateProfile) — deux premiers enregistrements
        // simultanés (double clic, deux onglets) se sérialisent : le second trouve le brouillon et le remplace.
        // Sans ligne candidat (compte jamais passé par son profil) : refus métier explicite, jamais un 500 de FK.
        if (candidateRepository.findByIdForUpdate(userId).isEmpty()) {
            log.warn("Application draft save rejected : no candidate profile, userId={}, offerId={}", userId,
                    offer.getId());
            throw new InvalidApplicationException(HttpStatus.CONFLICT, PROFILE_REQUIRED);
        }
        Application application = applicationRepository.findByCandidateIdAndJobOfferId(userId, offer.getId())
                .orElse(null);
        if (application == null) {
            application = Application.builder()
                    .id(UUID.randomUUID())
                    .candidateId(userId)
                    .jobOfferId(offer.getId())
                    .cvAttachmentId(currentCvId(userId).orElse(null))
                    .status(ApplicationStatus.DRAFT)
                    .build();
            applicationRepository.saveAndFlush(application);
            log.info("Application draft created : userId={}, applicationId={}, offerId={}",
                    userId, application.getId(), offer.getId());
        } else if (application.getStatus() != ApplicationStatus.DRAFT) {
            log.warn("Application draft save rejected : already submitted, userId={}, applicationId={}",
                    userId, application.getId());
            throw new InvalidApplicationException(HttpStatus.CONFLICT, ALREADY_APPLIED);
        } else {
            int removed = applicationAnswerRepository.deleteByApplicationIdInBulk(application.getId());
            log.info("Application draft answers replaced : applicationId={}, removed={}",
                    application.getId(), removed);
        }

        StoredAnswers stored = insertAnswers(application.getId(), offer.getId(), answers);
        log.info("Application draft saved : userId={}, applicationId={}, answers={}",
                userId, application.getId(), stored.rows().size());
        return toResponse(application, offer, questions, stored.rows(), stored.selectionsByAnswer(),
                labelsOf(optionsByQuestion));
    }

    /**
     * Transmission d'un brouillon : l'offre doit toujours être ouverte, toutes
     * les obligatoires répondues et un CV disponible (choisi, sinon celui du
     * brouillon, sinon le courant — 409 sans aucun CV). Le matching du couple
     * pour la fiche courante est rattaché s'il existe (D49).
     */
    @Transactional
    public ApplicationResponse submit(UUID userId, UUID applicationId, SubmitApplicationRequest request) {
        log.info("Application submit requested : userId={}, applicationId={}", userId, applicationId);
        Application application = ownedApplicationForUpdate(userId, applicationId, "submit");
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            log.warn("Application submit rejected : already submitted, applicationId={}, status={}",
                    applicationId, application.getStatus().getApiValue());
            throw new InvalidApplicationException(HttpStatus.CONFLICT, ALREADY_APPLIED);
        }
        JobOffer offer = jobOfferRepository.findById(application.getJobOfferId())
                .filter(ApplicationService::isOpen)
                .orElseThrow(() -> {
                    log.warn("Application submit rejected : offer closed, applicationId={}", applicationId);
                    return new InvalidApplicationException(HttpStatus.NOT_FOUND, OFFER_UNAVAILABLE);
                });
        List<JobOfferQuestion> questions = questionsOf(offer.getId());
        List<ApplicationAnswer> answerRows = applicationAnswerRepository.findByApplicationIdIn(List.of(applicationId));
        if (!missingRequired(questions, answerRows).isEmpty()) {
            log.warn("Application submit rejected : required question unanswered, applicationId={}", applicationId);
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST, "All required questions must be answered.");
        }
        UUID requestedCv = request == null ? null : request.cvAttachmentId();
        Attachment cv = resolveCv(userId, requestedCv, application.getCvAttachmentId());

        application.setCvAttachmentId(cv.getId());
        application.setMatchingId(currentMatchingId(userId, offer.getId()).orElse(null));
        application.setStatus(ApplicationStatus.SUBMITTED);
        application.setSubmittedAt(LocalDateTime.now());
        applicationRepository.saveAndFlush(application);
        log.info("Application submitted : userId={}, applicationId={}, offerId={}, withMatching={}",
                userId, applicationId, offer.getId(), application.getMatchingId() != null);

        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(questions);
        return toResponse(application, offer, questions, answerRows, selectionsOf(answerRows),
                labelsOf(optionsByQuestion));
    }

    /**
     * Abandon d'un brouillon : suppression de la candidature (réponses et
     * sélections en cascade SQL) — ce n'est pas encore un enregistrement. Le
     * matching, rattaché au couple et à la version de fiche, est conservé.
     */
    @Transactional
    public void discard(UUID userId, UUID applicationId) {
        log.info("Application discard requested : userId={}, applicationId={}", userId, applicationId);
        Application application = ownedApplication(userId, applicationId, "discard");
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            log.warn("Application discard rejected : applicationId={}, status={}",
                    applicationId, application.getStatus().getApiValue());
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "Only a draft application can be discarded.");
        }
        applicationRepository.delete(application);
        log.info("Application draft discarded : userId={}, applicationId={}", userId, applicationId);
    }

    /**
     * Contexte du parcours : l'offre doit être publiée et non expirée (même
     * 404 sûr que la lecture publique), les questions sortent sans
     * {@code preferred}, la candidature du couple avec ses réponses, l'étape
     * calculée et {@code canSubmit}. Offre sans aucune question : le parcours
     * s'ouvre directement à l'étape matching, avant même le brouillon — il naît
     * au premier geste du candidat (lancement du matching ou transmission).
     */
    @Transactional(readOnly = true)
    public ApplicationContextResponse getContext(UUID userId, String jobPublicId) {
        log.info("Application context requested : userId={}, jobPublicId={}", userId, jobPublicId);
        JobOffer offer = requireOpenOffer(jobPublicId);
        List<JobOfferQuestion> questions = questionsOf(offer.getId());
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = loadOptionsByQuestion(questions);
        List<ApplicationQuestionView> questionViews = questions.stream()
                .map(question -> new ApplicationQuestionView(question.getId(), question.getLabel(),
                        question.getQuestionType().getApiValue(), Boolean.TRUE.equals(question.getIsRequired()),
                        question.getSortOrder(), optionsByQuestion.getOrDefault(question.getId(), List.of()).stream()
                                .map(option -> new ApplicationQuestionOptionView(option.getId(), option.getLabel(),
                                        option.getSortOrder()))
                                .toList()))
                .toList();
        Application application = applicationRepository.findByCandidateIdAndJobOfferId(userId, offer.getId())
                .orElse(null);
        ApplicationSummary existing = null;
        List<ApplicationAnswerView> answerViews = List.of();
        ApplicationStep step = questions.isEmpty() ? ApplicationStep.MATCHING : ApplicationStep.RECRUITER_QUESTIONS;
        if (application != null) {
            existing = new ApplicationSummary(application.getId(), application.getStatus().getApiValue(),
                    application.getCvAttachmentId(), application.getCreatedAt());
            List<ApplicationAnswer> answerRows = applicationAnswerRepository
                    .findByApplicationIdIn(List.of(application.getId()));
            answerViews = buildAnswerViews(questions, answerRows, selectionsOf(answerRows), labelsOf(optionsByQuestion));
            step = stepOf(application, missingRequired(questions, answerRows).isEmpty());
        }
        UUID currentCvAttachmentId = currentCvId(userId).orElse(null);
        log.info("Application context served : userId={}, offerId={}, questions={}, status={}, step={}",
                userId, offer.getId(), questionViews.size(),
                application == null ? null : application.getStatus().getApiValue(), step.getApiValue());
        return new ApplicationContextResponse(jobSummary(offer), questionViews, currentCvAttachmentId, existing,
                answerViews, step.getApiValue(), step == ApplicationStep.MATCHING,
                assessmentOf(userId, offer, application));
    }

    /**
     * Avancement de l'évaluation IA (T-62/T-63) : matching rattaché à une
     * candidature transmise, sinon matching courant du couple.
     */
    private ApplicationAssessmentView assessmentOf(UUID userId, JobOffer offer, Application application) {
        Optional<UUID> matchingId = application != null && application.getStatus() != ApplicationStatus.DRAFT
                ? Optional.ofNullable(application.getMatchingId())
                : currentMatchingId(userId, offer.getId());
        return matchingId.flatMap(matchingRepository::findById)
                .map(matching -> {
                    boolean finished = matching.getAssessmentFinishedAt() != null;
                    return new ApplicationAssessmentView(true, !finished, finished,
                            feedbackRepository.existsByMatchingId(matching.getId()));
                })
                .orElse(ApplicationAssessmentView.NONE);
    }

    /**
     * « Mes candidatures » : candidatures du candidat connecté, brouillons
     * compris, plus récentes d'abord, réponses reconstruites dans l'ordre des
     * questions de l'offre.
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
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = selectionsOf(answerRows);
        Map<UUID, Attachment> attachmentsById = new HashMap<>();
        attachmentRepository.findAllById(applications.stream().map(Application::getCvAttachmentId)
                        .filter(Objects::nonNull).toList())
                .forEach(attachment -> attachmentsById.put(attachment.getId(), attachment));

        List<ApplicationResponse> responses = new ArrayList<>(applications.size());
        for (Application application : applications) {
            JobOffer offer = offersById.get(application.getJobOfferId());
            List<JobOfferQuestion> questions = questionsByOffer.getOrDefault(offer.getId(), List.of());
            List<ApplicationAnswerView> answerViews = buildAnswerViews(questions,
                    answersByApplication.getOrDefault(application.getId(), List.of()), selectionsByAnswer,
                    optionLabels);
            responses.add(new ApplicationResponse(application.getId(), application.getStatus().getApiValue(),
                    application.getCreatedAt(), application.getUpdatedAt(), jobSummary(offer),
                    cvSummary(application.getCvAttachmentId(), attachmentsById), answerViews));
        }
        log.info("Applications list served : userId={}, count={}", userId, responses.size());
        return responses;
    }

    /**
     * Retrait (D49) : uniquement depuis SUBMITTED — WITHDRAWN est terminal au
     * MVP (l'UNIQUE du couple interdit la repostulation) ; un brouillon
     * s'abandonne, il ne se retire pas.
     */
    @Transactional
    public void withdraw(UUID userId, UUID applicationId) {
        log.info("Application withdraw requested : userId={}, applicationId={}", userId, applicationId);
        Application application = ownedApplicationForUpdate(userId, applicationId, "withdraw");
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
     * Partagée avec le matching (même garde, même message).
     */
    public JobOffer requireOpenOffer(String publicId) {
        JobOffer offer = jobOfferRepository.findByPublicId(publicId)
                .orElseThrow(() -> {
                    log.warn("Application offer rejected : unknown publicId={}", publicId);
                    return new InvalidApplicationException(HttpStatus.NOT_FOUND, OFFER_UNAVAILABLE);
                });
        if (!isOpen(offer)) {
            log.warn("Application offer rejected : publicId={}, status={}, expiresAt={}",
                    publicId, offer.getStatus().getApiValue(), offer.getExpiresAt());
            throw new InvalidApplicationException(HttpStatus.NOT_FOUND, OFFER_UNAVAILABLE);
        }
        return offer;
    }

    /**
     * Candidature du couple et complétude de ses obligatoires — lue par le
     * matching pour ouvrir ou fermer l'accès (D59).
     */
    @Transactional(readOnly = true)
    public Optional<CoupleApplication> findCoupleApplication(UUID userId, UUID offerId) {
        return applicationRepository.findByCandidateIdAndJobOfferId(userId, offerId)
                .map(application -> new CoupleApplication(application.getStatus(),
                        missingRequired(questionsOf(offerId), applicationAnswerRepository
                                .findByApplicationIdIn(List.of(application.getId()))).isEmpty()));
    }

    /** État de la candidature d'un couple vu par le matching. */
    public record CoupleApplication(ApplicationStatus status, boolean requiredAnswered) {
    }

    private static boolean isOpen(JobOffer offer) {
        return offer.getStatus() == JobOfferStatus.PUBLISHED
                && (offer.getExpiresAt() == null || !offer.getExpiresAt().isBefore(LocalDate.now()));
    }

    private static ApplicationStep stepOf(Application application, boolean requiredAnswered) {
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            return ApplicationStep.SUBMITTED;
        }
        return requiredAnswered ? ApplicationStep.MATCHING : ApplicationStep.RECRUITER_QUESTIONS;
    }

    private Application ownedApplication(UUID userId, UUID applicationId, String action) {
        return applicationRepository.findByIdAndCandidateId(applicationId, userId)
                .orElseThrow(() -> applicationNotFound(userId, applicationId, action));
    }

    /**
     * Variante verrouillée de {@link #ownedApplication} : submit et withdraw
     * sérialisent leurs transitions pour qu'une candidature ne puisse jamais
     * être transmise deux fois ni retirée après une décision.
     */
    private Application ownedApplicationForUpdate(UUID userId, UUID applicationId, String action) {
        return applicationRepository.findByIdAndCandidateIdForUpdate(applicationId, userId)
                .orElseThrow(() -> applicationNotFound(userId, applicationId, action));
    }

    private ApplicationNotFoundException applicationNotFound(UUID userId, UUID applicationId, String action) {
        log.warn("Application {} rejected : unknown application or not owner, userId={}, applicationId={}",
                action, userId, applicationId);
        return new ApplicationNotFoundException(
                "application " + applicationId + " not found for candidate " + userId);
    }

    private Optional<UUID> currentCvId(UUID userId) {
        return candidateService.getCurrentCvAttachmentId(userId)
                .flatMap(id -> attachmentRepository.findByIdAndCandidateId(id, userId))
                .map(Attachment::getId);
    }

    /** Matching du couple pour la fiche normalisée courante du candidat (D49/D50), s'il existe. */
    private Optional<UUID> currentMatchingId(UUID userId, UUID offerId) {
        List<NormalizedProfile> latest = normalizedProfileRepository
                .findLatestWithContentByCandidateId(userId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            return Optional.empty();
        }
        return matchingRepository.findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(
                userId, offerId, latest.get(0).getId()).map(Matching::getId);
    }

    /**
     * CV de la transmission : l'identifiant demandé doit appartenir au
     * candidat (400 sinon — les anciens CV restent candidats au choix) ;
     * absent, le CV du brouillon puis le CV courant ; sans CV du tout, 409 (D46).
     */
    private Attachment resolveCv(UUID userId, UUID requestedId, UUID draftCvId) {
        if (requestedId != null) {
            return attachmentRepository.findByIdAndCandidateId(requestedId, userId)
                    .orElseThrow(() -> {
                        log.warn("Application submit rejected : unknown CV or not owner, userId={},"
                                + " attachmentId={}", userId, requestedId);
                        return new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                                "The selected CV is not available.");
                    });
        }
        Optional<Attachment> fallback = Optional.ofNullable(draftCvId)
                .flatMap(id -> attachmentRepository.findByIdAndCandidateId(id, userId))
                .or(() -> currentCvId(userId).flatMap(id -> attachmentRepository.findByIdAndCandidateId(id, userId)));
        return fallback.orElseThrow(() -> {
            log.warn("Application submit rejected : no CV, userId={}", userId);
            return new InvalidApplicationException(HttpStatus.CONFLICT,
                    "A CV is required to apply. Add one to your profile first.");
        });
    }

    private List<JobOfferQuestion> questionsOf(UUID offerId) {
        return jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(offerId));
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

    private Map<UUID, List<ApplicationAnswerOption>> selectionsOf(List<ApplicationAnswer> answerRows) {
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = new HashMap<>();
        if (!answerRows.isEmpty()) {
            applicationAnswerOptionRepository
                    .findByApplicationAnswerIdIn(answerRows.stream().map(ApplicationAnswer::getId).toList())
                    .forEach(selection -> selectionsByAnswer
                            .computeIfAbsent(selection.getApplicationAnswerId(), key -> new ArrayList<>())
                            .add(selection));
        }
        return selectionsByAnswer;
    }

    /** Questions obligatoires sans réponse enregistrée (vide = brouillon complet). */
    private static List<UUID> missingRequired(List<JobOfferQuestion> questions, List<ApplicationAnswer> answerRows) {
        Set<UUID> answered = answerRows.stream().map(ApplicationAnswer::getQuestionId).collect(Collectors.toSet());
        return questions.stream()
                .filter(question -> Boolean.TRUE.equals(question.getIsRequired()))
                .map(JobOfferQuestion::getId)
                .filter(id -> !answered.contains(id))
                .toList();
    }

    /**
     * Validation des réponses fournies (D48) : question connue de l'offre, pas
     * de doublon, exactement un porteur adapté au type (cardinalité QCS = 1 /
     * QCM ≥ 1 contrôlée ici — la base ne lit pas question_type), options
     * appartenant à leur question (la chaîne FK les reverrouille en base).
     * Résultat trié dans l'ordre des questions. La complétude des obligatoires
     * est contrôlée à part (brouillon partiel permis).
     */
    private List<ValidatedAnswer> validateAnswers(List<JobOfferQuestion> questions,
            Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion, List<ApplicationAnswerRequest> requests) {
        Map<UUID, JobOfferQuestion> questionsById = new LinkedHashMap<>();
        questions.forEach(question -> questionsById.put(question.getId(), question));
        Map<UUID, ValidatedAnswer> answersByQuestion = new HashMap<>();
        for (ApplicationAnswerRequest request : requests) {
            if (request.questionId() == null || !questionsById.containsKey(request.questionId())) {
                log.warn("Application draft rejected : answer for unknown question, questionId={}",
                        request.questionId());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "Unknown question in your submission.");
            }
            JobOfferQuestion question = questionsById.get(request.questionId());
            if (answersByQuestion.containsKey(question.getId())) {
                log.warn("Application draft rejected : duplicate answer, questionId={}", question.getId());
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
                log.warn("Application draft rejected : invalid answer, questionId={}, type={}",
                        question.getId(), type.getApiValue());
                throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                        "Answer for question '" + question.getLabel() + "' is invalid.");
            }
            answersByQuestion.put(question.getId(), new ValidatedAnswer(question,
                    request.text() == null ? null : request.text().trim(),
                    request.number(), request.booleanValue(), optionIds));
        }
        return questions.stream()
                .map(question -> answersByQuestion.get(question.getId()))
                .filter(Objects::nonNull)
                .toList();
    }

    /** Insertion par étages des réponses puis des sélections (D48, contraintes IMMEDIATE). */
    private StoredAnswers insertAnswers(UUID applicationId, UUID offerId, List<ValidatedAnswer> answers) {
        List<ApplicationAnswer> answerRows = new ArrayList<>(answers.size());
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = new LinkedHashMap<>();
        for (ValidatedAnswer answer : answers) {
            UUID answerId = UUID.randomUUID();
            answerRows.add(ApplicationAnswer.builder()
                    .id(answerId)
                    .applicationId(applicationId)
                    .jobOfferId(offerId)
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
        return new StoredAnswers(answerRows, selectionsByAnswer);
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

    private ApplicationResponse toResponse(Application application, JobOffer offer, List<JobOfferQuestion> questions,
            List<ApplicationAnswer> answerRows, Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer,
            Map<UUID, String> optionLabels) {
        Map<UUID, Attachment> attachmentsById = new HashMap<>();
        if (application.getCvAttachmentId() != null) {
            attachmentRepository.findById(application.getCvAttachmentId())
                    .ifPresent(attachment -> attachmentsById.put(attachment.getId(), attachment));
        }
        return new ApplicationResponse(application.getId(), application.getStatus().getApiValue(),
                application.getCreatedAt(), application.getUpdatedAt(), jobSummary(offer),
                cvSummary(application.getCvAttachmentId(), attachmentsById),
                buildAnswerViews(questions, answerRows, selectionsByAnswer, optionLabels));
    }

    private static ApplicationCvSummary cvSummary(UUID cvAttachmentId, Map<UUID, Attachment> attachmentsById) {
        if (cvAttachmentId == null) {
            return null;
        }
        Attachment cv = attachmentsById.get(cvAttachmentId);
        return new ApplicationCvSummary(cvAttachmentId, cv == null ? null : cv.getOriginalName());
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

    /** Réponses insérées et leurs sélections, pour composer la réponse HTTP. */
    private record StoredAnswers(List<ApplicationAnswer> rows,
            Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer) {
    }
}
