package com.linqorbit.application.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.JsonNode;

import com.linqorbit.application.dto.CriterionReportRequest;
import com.linqorbit.application.dto.RecruiterAnswerOptionView;
import com.linqorbit.application.dto.RecruiterAnswerView;
import com.linqorbit.application.dto.RecruiterApplicationCard;
import com.linqorbit.application.dto.RecruiterApplicationDetail;
import com.linqorbit.application.dto.RecruiterApplicationPageResponse;
import com.linqorbit.application.dto.RecruiterAssessmentView;
import com.linqorbit.application.dto.RecruiterCandidateSummary;
import com.linqorbit.application.dto.RecruiterClarificationView;
import com.linqorbit.application.dto.RecruiterContestationView;
import com.linqorbit.application.dto.RecruiterCriterionReportView;
import com.linqorbit.application.dto.RecruiterCvSummary;
import com.linqorbit.application.dto.RecruiterDecisionRequest;
import com.linqorbit.application.dto.RecruiterJobSummary;
import com.linqorbit.application.dto.RecruiterSectionScore;
import com.linqorbit.application.entity.Application;
import com.linqorbit.application.entity.ApplicationAnswer;
import com.linqorbit.application.entity.ApplicationAnswerOption;
import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.exception.ApplicationNotFoundException;
import com.linqorbit.application.exception.InvalidApplicationException;
import com.linqorbit.application.repository.ApplicationAnswerOptionRepository;
import com.linqorbit.application.repository.ApplicationAnswerRepository;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.attachment.dto.AttachmentContent;
import com.linqorbit.attachment.entity.Attachment;
import com.linqorbit.attachment.exception.AttachmentNotFoundException;
import com.linqorbit.attachment.repository.AttachmentRepository;
import com.linqorbit.attachment.service.AttachmentService;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.common.pagination.PageSizes;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferQuestion;
import com.linqorbit.joboffer.entity.JobOfferQuestionOption;
import com.linqorbit.joboffer.repository.JobOfferQuestionOptionRepository;
import com.linqorbit.joboffer.repository.JobOfferQuestionRepository;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.matching.entity.Clarification;
import com.linqorbit.matching.entity.ClarificationStatus;
import com.linqorbit.matching.entity.CriterionReportReason;
import com.linqorbit.matching.entity.MatchingCriterionFeedback;
import com.linqorbit.matching.entity.MatchingCriterionReport;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.repository.ClarificationRepository;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;
import com.linqorbit.matching.service.MatchingSection;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;

/**
 * Vue recruteur des candidatures (T-66, D65) : liste paginée par offre, détail
 * d'une candidature transmise/décidée, téléchargement du CV épinglé et
 * décisions manuelles terminales.
 *
 * <p>Les lectures sont ouvertes à tout membre de la company (D12) ; les
 * décisions reprennent le verrou de gestion de l'offre (owner ou créateur).
 * Les brouillons et retraits sont invisibles (404), les décisions ne
 * recalculent jamais le matching.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecruiterApplicationService {

    private static final String DEFAULT_SORT = "submittedAt";
    /** Vocabulaire des sections : une seule source (domaine matching). */
    private static final List<MatchingSection> SECTIONS = List.of(MatchingSection.values());
    private static final List<String> SECTION_SORTS = SECTIONS.stream()
            .map(MatchingSection::getSectionKey).toList();
    private static final List<String> SORTS = Stream.concat(
            Stream.concat(Stream.of(DEFAULT_SORT), SECTION_SORTS.stream()),
            Stream.of("contests")).toList();

    private final ApplicationRepository applicationRepository;
    private final ApplicationAnswerRepository applicationAnswerRepository;
    private final ApplicationAnswerOptionRepository applicationAnswerOptionRepository;
    private final JobOfferQuestionRepository jobOfferQuestionRepository;
    private final JobOfferQuestionOptionRepository jobOfferQuestionOptionRepository;
    private final AttachmentRepository attachmentRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final MatchingResultRepository matchingResultRepository;
    private final MatchingCriterionFeedbackRepository feedbackRepository;
    private final MatchingCriterionReportRepository criterionReportRepository;
    private final ClarificationRepository clarificationRepository;
    private final JobOfferService jobOfferService;
    private final AttachmentService attachmentService;
    private final ApplicationAssessmentReader assessmentReader;

    @Transactional(readOnly = true)
    public RecruiterApplicationPageResponse list(UUID userId, UUID offerId, String status, String sort,
            String direction, Integer page, Integer size) {
        JobOffer offer = jobOfferService.getForMember(userId, offerId);
        ApplicationStatus filter = parseStatus(status);
        String normalizedSort = parseSort(sort);
        String normalizedDirection = parseDirection(direction);
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        long total = applicationRepository.countRecruiterApplications(offerId, (short) filter.getCode());
        log.info("Recruiter applications list requested : userId={}, offerId={}, status={}, sort={}, direction={},"
                        + " page={}, size={}", userId, offerId, filter.getApiValue(), normalizedSort,
                normalizedDirection, safePage, safeSize);
        if (total == 0) {
            return new RecruiterApplicationPageResponse(jobSummary(offer), List.of(), safePage, safeSize, 0);
        }
        List<UUID> ids = applicationRepository.findRecruiterApplicationIds(offerId, (short) filter.getCode(),
                normalizedSort, normalizedDirection, safeSize, (long) safePage * safeSize);
        if (ids.isEmpty()) {
            return new RecruiterApplicationPageResponse(jobSummary(offer), List.of(), safePage, safeSize, total);
        }
        Map<UUID, Application> applicationsById = new HashMap<>();
        applicationRepository.findAllById(ids).forEach(application ->
                applicationsById.put(application.getId(), application));
        List<Application> applications = ids.stream()
                .map(applicationsById::get)
                .filter(Objects::nonNull)
                .toList();
        PageContext context = loadContext(applications);
        List<RecruiterApplicationCard> items = new ArrayList<>(applications.size());
        for (Application application : applications) {
            items.add(toCard(application, context));
        }
        log.info("Recruiter applications list served : userId={}, offerId={}, count={}, total={}",
                userId, offerId, items.size(), total);
        return new RecruiterApplicationPageResponse(jobSummary(offer), items, safePage, safeSize, total);
    }

    @Transactional(readOnly = true)
    public RecruiterApplicationDetail detail(UUID userId, UUID offerId, UUID applicationId) {
        JobOffer offer = jobOfferService.getForMember(userId, offerId);
        Application application = visibleApplication(offerId, applicationId);
        log.info("Recruiter application detail requested : userId={}, offerId={}, applicationId={}",
                userId, offerId, applicationId);

        List<JobOfferQuestion> questions = jobOfferQuestionRepository
                .findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(offerId));
        List<ApplicationAnswer> answerRows = applicationAnswerRepository
                .findByApplicationIdIn(List.of(applicationId));
        Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer = selectionsOf(answerRows);
        Map<UUID, JobOfferQuestionOption> optionsById = optionsOf(questions);
        List<RecruiterAnswerView> answers = answerViews(questions, answerRows, selectionsByAnswer, optionsById);

        MatchingResult latest = application.getMatchingId() == null ? null
                : matchingResultRepository.findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(
                        application.getMatchingId()).orElse(null);
        JsonNode assessmentRoot = assessmentReader.tree(latest);
        RecruiterAssessmentView assessment = assessmentReader.assessment(assessmentRoot);
        List<RecruiterClarificationView> clarifications = clarifications(application.getMatchingId());
        List<MatchingCriterionFeedback> feedback = application.getMatchingId() == null ? List.of()
                : feedbackRepository.findByMatchingIdOrderByCriterionKeyAsc(application.getMatchingId());
        Map<UUID, MatchingResult> feedbackResults = assessmentReader.feedbackResults(feedback);
        List<RecruiterContestationView> contests = assessmentReader.contests(feedback, feedbackResults,
                assessmentRoot);
        // Même mesure que la carte de liste : l'écart moyen est calculé par le
        // serveur, jamais déduit côté client.
        ApplicationAssessmentReader.GapStats gap = assessmentReader.gapStats(feedback, feedbackResults,
                assessmentRoot);
        // Signalements de l'auteur courant sur le résultat affiché (D66) : un
        // signalement est privé, le détail n'en montre que les siens.
        List<RecruiterCriterionReportView> criterionReports = criterionReports(latest, userId);

        Attachment attachment = application.getCvAttachmentId() == null ? null
                : attachmentRepository.findByIdAndCandidateId(application.getCvAttachmentId(),
                        application.getCandidateId()).orElse(null);
        RecruiterCvSummary cv = attachment == null ? null
                : new RecruiterCvSummary(attachment.getId(), attachment.getOriginalName(), attachment.getSizeBytes());
        User candidate = userRepository.findById(application.getCandidateId()).orElse(null);
        Candidate candidateProfile = candidateRepository.findById(application.getCandidateId()).orElse(null);
        boolean canDecide = application.getStatus() == ApplicationStatus.SUBMITTED
                && jobOfferService.canManage(userId, offer);

        log.info("Recruiter application detail served : userId={}, applicationId={}, status={}, assessment={}",
                userId, applicationId, application.getStatus().getApiValue(), assessment.available());
        return new RecruiterApplicationDetail(application.getId(), candidate(candidate, candidateProfile),
                application.getStatus().getApiValue(), application.getSubmittedAt(), canDecide,
                jobSummary(offer), answers, assessment, clarifications, contests, gap.averageGap(),
                criterionReports, cv);
    }

    @Transactional(readOnly = true)
    public AttachmentContent cv(UUID userId, UUID offerId, UUID applicationId) {
        jobOfferService.getForMember(userId, offerId);
        Application application = visibleApplication(offerId, applicationId);
        if (application.getCvAttachmentId() == null) {
            log.warn("Recruiter CV download rejected : no pinned CV, applicationId={}", applicationId);
            throw new AttachmentNotFoundException("no CV for application " + applicationId);
        }
        log.info("Recruiter CV download requested : userId={}, offerId={}, applicationId={}, attachmentId={}",
                userId, offerId, applicationId, application.getCvAttachmentId());
        return attachmentService.downloadPinned(application.getCandidateId(), application.getCvAttachmentId());
    }

    @Transactional
    public void decide(UUID userId, UUID offerId, UUID applicationId, RecruiterDecisionRequest request) {
        JobOffer offer = jobOfferService.getForManagement(userId, offerId);
        ApplicationStatus decision = parseDecision(request == null ? null : request.decision());
        Application application = applicationRepository.findByIdAndJobOfferIdForUpdate(applicationId, offerId)
                .orElseThrow(() -> applicationNotFound(offerId, applicationId));
        if (application.getStatus() == ApplicationStatus.DRAFT
                || application.getStatus() == ApplicationStatus.WITHDRAWN) {
            log.warn("Recruiter decision rejected : application not visible, applicationId={}, status={}",
                    applicationId, application.getStatus().getApiValue());
            throw applicationNotFound(offerId, applicationId);
        }
        if (application.getStatus() == ApplicationStatus.ACCEPTED
                || application.getStatus() == ApplicationStatus.REJECTED) {
            log.warn("Recruiter decision rejected : already decided, applicationId={}, status={}",
                    applicationId, application.getStatus().getApiValue());
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "This application has already been decided.");
        }
        application.setStatus(decision);
        applicationRepository.saveAndFlush(application);
        log.info("Recruiter decision recorded : userId={}, offerId={}, applicationId={}, status={}",
                userId, offer.getId(), applicationId, decision.getApiValue());
    }

    /**
     * Signalement interne d'une évaluation IA, par critère (T-86, D66).
     *
     * <p>Le résultat affiché est résolu <b>par le serveur</b> (le dernier
     * résultat terminé du matching) — le client n'envoie que la clé du
     * critère : la clé est relue dans le JSON de ce résultat, jamais
     * recalculée. Le signalement est <b>interne</b> : aucun effet sur le
     * score, aucune réévaluation, aucune visibilité côté candidat ; il est
     * immuable (un second signalement du même auteur sur le même critère est
     * refusé).</p>
     */
    @Transactional
    public void reportCriterion(UUID userId, UUID offerId, UUID applicationId, CriterionReportRequest request) {
        JobOffer offer = jobOfferService.getForMember(userId, offerId);
        Application application = visibleApplication(offerId, applicationId);
        log.info("Recruiter criterion report requested : userId={}, offerId={}, applicationId={}",
                userId, offerId, applicationId);

        MatchingResult latest = application.getMatchingId() == null ? null
                : matchingResultRepository.findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(
                        application.getMatchingId()).orElse(null);
        if (latest == null) {
            log.warn("Recruiter criterion report rejected : no finished assessment, applicationId={}",
                    applicationId);
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "This application has no finished AI assessment to report.");
        }
        String criterionKey = request.criterionKey().trim();
        if (assessmentReader.criterion(assessmentReader.tree(latest), criterionKey) == null) {
            log.warn("Recruiter criterion report rejected : unknown criterion, applicationId={}, key={}",
                    applicationId, criterionKey);
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "This criterion does not exist in the assessment of this application.");
        }
        CriterionReportReason reason = parseReportReason(request.reason());
        String comment = normalizeComment(request.comment());
        if (reason.requiresComment() && comment == null) {
            log.warn("Recruiter criterion report rejected : comment required, applicationId={}, key={}",
                    applicationId, criterionKey);
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "A comment is required when the reason is other.");
        }
        if (criterionReportRepository.existsByMatchingResultIdAndCriterionKeyAndAuthorUserId(
                latest.getId(), criterionKey, userId)) {
            log.warn("Recruiter criterion report rejected : already reported, applicationId={}, key={}",
                    applicationId, criterionKey);
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "You have already reported this criterion.");
        }
        MatchingCriterionReport report = MatchingCriterionReport.builder()
                .id(UUID.randomUUID())
                .matchingId(latest.getMatchingId())
                .matchingResultId(latest.getId())
                .criterionKey(criterionKey)
                .authorUserId(userId)
                .reason(reason)
                .comment(comment)
                .build();
        try {
            criterionReportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException ex) {
            // Course entre deux signalements du même auteur sur le même critère :
            // l'unicité de la base tranche, jamais une 500.
            log.warn("Recruiter criterion report rejected : concurrent duplicate, applicationId={}, key={}",
                    applicationId, criterionKey);
            throw new InvalidApplicationException(HttpStatus.CONFLICT,
                    "You have already reported this criterion.");
        }
        log.info("Recruiter criterion report recorded : userId={}, offerId={}, applicationId={}, key={}, reason={}",
                userId, offer.getId(), applicationId, criterionKey, reason.getApiValue());
    }

    private List<RecruiterCriterionReportView> criterionReports(MatchingResult latest, UUID userId) {
        if (latest == null) {
            return List.of();
        }
        return criterionReportRepository
                .findByMatchingResultIdAndAuthorUserIdOrderByCriterionKeyAsc(latest.getId(), userId)
                .stream()
                .map(report -> new RecruiterCriterionReportView(report.getCriterionKey(),
                        report.getReason().getApiValue(), report.getComment(), report.getCreatedAt()))
                .toList();
    }

    private static CriterionReportReason parseReportReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Reason must be scoreIncorrect, evidenceWrong, profileMisunderstood,"
                            + " requirementMisunderstood or other.");
        }
        String value = reason.trim();
        for (CriterionReportReason candidate : CriterionReportReason.values()) {
            if (candidate.getApiValue().equals(value)) {
                return candidate;
            }
        }
        throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                "Reason must be scoreIncorrect, evidenceWrong, profileMisunderstood,"
                        + " requirementMisunderstood or other.");
    }

    /** Commentaire nettoyé : blanc ou absent → {@code null} (jamais une chaîne vide). */
    private static String normalizeComment(String comment) {
        if (comment == null) {
            return null;
        }
        String trimmed = comment.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Application visibleApplication(UUID offerId, UUID applicationId) {
        return applicationRepository.findByIdAndJobOfferId(applicationId, offerId)
                .filter(application -> application.getStatus() != ApplicationStatus.DRAFT
                        && application.getStatus() != ApplicationStatus.WITHDRAWN)
                .orElseThrow(() -> applicationNotFound(offerId, applicationId));
    }

    private ApplicationNotFoundException applicationNotFound(UUID offerId, UUID applicationId) {
        return new ApplicationNotFoundException(
                "application " + applicationId + " not found for job offer " + offerId);
    }

    private RecruiterApplicationCard toCard(Application application, PageContext context) {
        MatchingResult latest = application.getMatchingId() == null ? null
                : context.latestResults().get(application.getMatchingId());
        JsonNode root = assessmentReader.tree(latest);
        List<MatchingCriterionFeedback> feedback = application.getMatchingId() == null ? List.of()
                : context.feedback().getOrDefault(application.getMatchingId(), List.of());
        ApplicationAssessmentReader.GapStats gap = assessmentReader.gapStats(feedback,
                context.feedbackResults(), root);
        List<RecruiterSectionScore> sections = SECTIONS.stream()
                .map(section -> new RecruiterSectionScore(section.getSectionKey(),
                        sectionScore(root, section.getStorageValue())))
                .toList();
        return new RecruiterApplicationCard(application.getId(),
                candidate(context.users().get(application.getCandidateId()),
                        context.candidates().get(application.getCandidateId())),
                application.getStatus().getApiValue(), application.getSubmittedAt(), root != null,
                sections, feedback.size(), gap.averageGap());
    }

    private PageContext loadContext(List<Application> applications) {
        List<UUID> candidateIds = applications.stream().map(Application::getCandidateId).distinct().toList();
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(candidateIds).forEach(user -> users.put(user.getId(), user));
        Map<UUID, Candidate> candidates = new HashMap<>();
        candidateRepository.findAllById(candidateIds)
                .forEach(candidate -> candidates.put(candidate.getId(), candidate));

        List<UUID> matchingIds = applications.stream().map(Application::getMatchingId)
                .filter(Objects::nonNull).distinct().toList();
        Map<UUID, MatchingResult> latestResults = new HashMap<>();
        Map<UUID, List<MatchingCriterionFeedback>> feedback = new HashMap<>();
        if (!matchingIds.isEmpty()) {
            matchingResultRepository
                    .findByMatchingIdInAndResultIsNotNullOrderByMatchingIdAscVersionDesc(matchingIds)
                    .forEach(result -> latestResults.putIfAbsent(result.getMatchingId(), result));
            feedbackRepository.findByMatchingIdInOrderByMatchingIdAscCriterionKeyAsc(matchingIds)
                    .forEach(item -> feedback.computeIfAbsent(item.getMatchingId(), key -> new ArrayList<>())
                            .add(item));
        }
        List<MatchingCriterionFeedback> allFeedback = feedback.values().stream().flatMap(List::stream).toList();
        return new PageContext(users, candidates, latestResults, feedback,
                assessmentReader.feedbackResults(allFeedback));
    }

    private Map<UUID, List<ApplicationAnswerOption>> selectionsOf(List<ApplicationAnswer> answerRows) {
        if (answerRows.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<ApplicationAnswerOption>> selections = new HashMap<>();
        applicationAnswerOptionRepository.findByApplicationAnswerIdIn(
                        answerRows.stream().map(ApplicationAnswer::getId).toList())
                .forEach(selection -> selections
                        .computeIfAbsent(selection.getApplicationAnswerId(), key -> new ArrayList<>())
                        .add(selection));
        return selections;
    }

    private Map<UUID, JobOfferQuestionOption> optionsOf(List<JobOfferQuestion> questions) {
        List<UUID> choiceIds = questions.stream()
                .filter(question -> question.getQuestionType().isChoice())
                .map(JobOfferQuestion::getId)
                .toList();
        if (choiceIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, JobOfferQuestionOption> options = new HashMap<>();
        jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(choiceIds)
                .forEach(option -> options.put(option.getId(), option));
        return options;
    }

    private static List<RecruiterAnswerView> answerViews(List<JobOfferQuestion> questions,
            List<ApplicationAnswer> answerRows, Map<UUID, List<ApplicationAnswerOption>> selectionsByAnswer,
            Map<UUID, JobOfferQuestionOption> optionsById) {
        Map<UUID, ApplicationAnswer> answersByQuestion = new HashMap<>();
        answerRows.forEach(answer -> answersByQuestion.put(answer.getQuestionId(), answer));
        return questions.stream()
                .map(question -> {
                    ApplicationAnswer answer = answersByQuestion.get(question.getId());
                    if (answer == null) {
                        return null;
                    }
                    List<RecruiterAnswerOptionView> options = selectionsByAnswer
                            .getOrDefault(answer.getId(), List.of()).stream()
                            .map(selection -> optionsById.get(selection.getOptionId()))
                            .filter(Objects::nonNull)
                            .sorted((left, right) -> {
                                int order = Integer.compare(left.getSortOrder(), right.getSortOrder());
                                return order != 0 ? order : left.getId().compareTo(right.getId());
                            })
                            .map(option -> new RecruiterAnswerOptionView(option.getId(), option.getLabel(),
                                    Boolean.TRUE.equals(option.getPreferred())))
                            .toList();
                    return new RecruiterAnswerView(question.getId(), question.getLabel(),
                            question.getQuestionType().getApiValue(), Boolean.TRUE.equals(question.getIsRequired()),
                            answer.getAnswerText(), answer.getAnswerNumber(), answer.getAnswerBoolean(), options);
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private List<RecruiterClarificationView> clarifications(UUID matchingId) {
        if (matchingId == null) {
            return List.of();
        }
        return clarificationRepository.findByMatchingIdAndStatusInOrderByCreatedAtAscIdAsc(matchingId,
                        List.of(ClarificationStatus.OPEN, ClarificationStatus.ANSWERED, ClarificationStatus.SKIPPED))
                .stream()
                .map(this::clarification)
                .toList();
    }

    private RecruiterClarificationView clarification(Clarification clarification) {
        return new RecruiterClarificationView(clarification.getId(), clarification.getQuestion(),
                clarification.getRationale(), clarification.getAnswer(), clarification.getStatus().getApiValue());
    }

    private static JsonNode sectionNode(JsonNode root, String storageValue) {
        if (root == null) {
            return null;
        }
        for (JsonNode section : root.path("sections")) {
            if (storageValue.equals(section.path("section").asString())) {
                return section;
            }
        }
        return null;
    }

    private static Double sectionScore(JsonNode root, String storageValue) {
        JsonNode section = sectionNode(root, storageValue);
        return section == null ? null : scoreOf(section);
    }

    private static Double scoreOf(JsonNode section) {
        JsonNode score = section.get("score");
        return score == null || score.isNull() ? null : score.asDouble();
    }

    private RecruiterJobSummary jobSummary(JobOffer offer) {
        String companyName = companyRepository.findById(offer.getCompanyId())
                .map(Company::getName)
                .orElse(null);
        return new RecruiterJobSummary(offer.getId(), offer.getPublicId(), offer.getSlug(), offer.getTitle(),
                offer.getStatus().getApiValue(), companyName);
    }

    private static RecruiterCandidateSummary candidate(User user, Candidate candidate) {
        if (user == null) {
            return null;
        }
        String title = candidate == null ? null : candidate.getTitle();
        return new RecruiterCandidateSummary(user.getFirstName(), user.getLastName(),
                title == null || title.isBlank() ? null : title.trim());
    }

    private static ApplicationStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return ApplicationStatus.SUBMITTED;
        }
        String value = status.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "submitted" -> ApplicationStatus.SUBMITTED;
            case "accepted" -> ApplicationStatus.ACCEPTED;
            case "rejected" -> ApplicationStatus.REJECTED;
            default -> throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Status must be submitted, accepted or rejected.");
        };
    }

    private static String parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return DEFAULT_SORT;
        }
        String value = sort.trim();
        if (!SORTS.contains(value)) {
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Sort must be submittedAt, requiredSkills, preferredSkills, languages, experience, education"
                            + " or contests.");
        }
        return value;
    }

    private static String parseDirection(String direction) {
        if (direction == null || direction.isBlank()) {
            return "asc";
        }
        String value = direction.trim().toLowerCase(Locale.ROOT);
        if (!value.equals("asc") && !value.equals("desc")) {
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Direction must be asc or desc.");
        }
        return value;
    }

    private static ApplicationStatus parseDecision(String decision) {
        if (decision == null) {
            throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Decision must be accepted or rejected.");
        }
        return switch (decision.trim().toLowerCase(Locale.ROOT)) {
            case "accepted" -> ApplicationStatus.ACCEPTED;
            case "rejected" -> ApplicationStatus.REJECTED;
            default -> throw new InvalidApplicationException(HttpStatus.BAD_REQUEST,
                    "Decision must be accepted or rejected.");
        };
    }

    private record PageContext(Map<UUID, User> users, Map<UUID, Candidate> candidates,
            Map<UUID, MatchingResult> latestResults,
            Map<UUID, List<MatchingCriterionFeedback>> feedback,
            Map<UUID, MatchingResult> feedbackResults) {
    }
}
