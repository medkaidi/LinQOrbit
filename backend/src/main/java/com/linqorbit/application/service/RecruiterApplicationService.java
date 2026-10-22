package com.linqorbit.application.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.linqorbit.application.dto.RecruiterAnswerOptionView;
import com.linqorbit.application.dto.RecruiterAnswerView;
import com.linqorbit.application.dto.RecruiterApplicationCard;
import com.linqorbit.application.dto.RecruiterApplicationDetail;
import com.linqorbit.application.dto.RecruiterApplicationPageResponse;
import com.linqorbit.application.dto.RecruiterAssessmentSectionView;
import com.linqorbit.application.dto.RecruiterAssessmentView;
import com.linqorbit.application.dto.RecruiterCandidateSummary;
import com.linqorbit.application.dto.RecruiterClarificationView;
import com.linqorbit.application.dto.RecruiterContestationView;
import com.linqorbit.application.dto.RecruiterCriterionView;
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
import com.linqorbit.matching.entity.MatchingCriterionFeedback;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.repository.ClarificationRepository;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;
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
    private static final List<String> SECTION_SORTS = List.of(
            "requiredSkills", "preferredSkills", "languages", "experience", "education");
    private static final List<String> SORTS = List.of(
            DEFAULT_SORT, "requiredSkills", "preferredSkills", "languages", "experience", "education", "contests");
    private static final List<SectionDefinition> SECTIONS = List.of(
            new SectionDefinition("requiredSkills", "required_skills"),
            new SectionDefinition("preferredSkills", "preferred_skills"),
            new SectionDefinition("languages", "languages"),
            new SectionDefinition("experience", "experience"),
            new SectionDefinition("education", "education"));

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
    private final ClarificationRepository clarificationRepository;
    private final JobOfferService jobOfferService;
    private final AttachmentService attachmentService;
    private final ObjectMapper objectMapper;

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
        JsonNode assessmentRoot = resultTree(latest);
        RecruiterAssessmentView assessment = assessment(assessmentRoot);
        List<RecruiterClarificationView> clarifications = clarifications(application.getMatchingId());
        List<MatchingCriterionFeedback> feedback = application.getMatchingId() == null ? List.of()
                : feedbackRepository.findByMatchingIdOrderByCriterionKeyAsc(application.getMatchingId());
        Map<UUID, MatchingResult> feedbackResults = feedbackResults(feedback);
        List<RecruiterContestationView> contests = contests(feedback, feedbackResults, assessmentRoot);
        // Même mesure que la carte de liste : l'écart moyen est calculé par le
        // serveur, jamais déduit côté client.
        GapStats gap = gapStats(feedback, feedbackResults, assessmentRoot);

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
                jobSummary(offer), answers, assessment, clarifications, contests, gap.averageGap(), cv);
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
        JsonNode root = resultTree(latest);
        List<MatchingCriterionFeedback> feedback = application.getMatchingId() == null ? List.of()
                : context.feedback().getOrDefault(application.getMatchingId(), List.of());
        GapStats gap = gapStats(feedback, context.feedbackResults(), root);
        List<RecruiterSectionScore> sections = SECTIONS.stream()
                .map(section -> new RecruiterSectionScore(section.apiValue(), sectionScore(root, section.storageValue())))
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
        return new PageContext(users, candidates, latestResults, feedback, feedbackResults(allFeedback));
    }

    private Map<UUID, MatchingResult> feedbackResults(List<MatchingCriterionFeedback> feedback) {
        List<UUID> ids = feedback.stream().map(MatchingCriterionFeedback::getMatchingResultId)
                .distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, MatchingResult> results = new HashMap<>();
        matchingResultRepository.findAllById(ids).forEach(result -> results.put(result.getId(), result));
        return results;
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

    private RecruiterAssessmentView assessment(JsonNode root) {
        if (root == null) {
            return new RecruiterAssessmentView(false, List.of());
        }
        List<RecruiterAssessmentSectionView> sections = new ArrayList<>(SECTIONS.size());
        for (SectionDefinition section : SECTIONS) {
            JsonNode node = sectionNode(root, section.storageValue());
            sections.add(new RecruiterAssessmentSectionView(section.apiValue(),
                    node == null ? null : scoreOf(node), criteria(node)));
        }
        return new RecruiterAssessmentView(true, sections);
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

    private List<RecruiterContestationView> contests(List<MatchingCriterionFeedback> feedback,
            Map<UUID, MatchingResult> feedbackResults, JsonNode latestRoot) {
        List<RecruiterContestationView> contests = new ArrayList<>(feedback.size());
        for (MatchingCriterionFeedback item : feedback) {
            JsonNode root = resultTree(feedbackResults.get(item.getMatchingResultId()));
            CriterionScore criterion = criterion(root, item.getCriterionKey());
            if (criterion == null && root != latestRoot) {
                criterion = criterion(latestRoot, item.getCriterionKey());
            }
            if (criterion == null) {
                log.warn("Recruiter contestation skipped : criterion missing, feedbackId={}, key={}",
                        item.getId(), item.getCriterionKey());
                continue;
            }
            int gap = Math.abs(item.getSelfValue() - criterion.score());
            contests.add(new RecruiterContestationView(item.getCriterionKey(), criterion.label(),
                    criterion.score(), item.getSelfValue(), gap, item.getComment()));
        }
        return contests;
    }

    private GapStats gapStats(List<MatchingCriterionFeedback> feedback,
            Map<UUID, MatchingResult> feedbackResults, JsonNode latestRoot) {
        if (feedback.isEmpty()) {
            return GapStats.NONE;
        }
        BigDecimal total = BigDecimal.ZERO;
        int counted = 0;
        for (MatchingCriterionFeedback item : feedback) {
            JsonNode root = resultTree(feedbackResults.get(item.getMatchingResultId()));
            CriterionScore criterion = criterion(root, item.getCriterionKey());
            if (criterion == null && root != latestRoot) {
                criterion = criterion(latestRoot, item.getCriterionKey());
            }
            if (criterion != null) {
                total = total.add(BigDecimal.valueOf(Math.abs(item.getSelfValue() - criterion.score())));
                counted++;
            }
        }
        Double average = counted == 0 ? null
                : total.divide(BigDecimal.valueOf(counted), 1, RoundingMode.HALF_UP).doubleValue();
        return new GapStats(feedback.size(), average);
    }

    private JsonNode resultTree(MatchingResult result) {
        return result == null || result.getResult() == null ? null : objectMapper.readTree(result.getResult());
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

    private static List<RecruiterCriterionView> criteria(JsonNode section) {
        if (section == null) {
            return List.of();
        }
        List<RecruiterCriterionView> criteria = new ArrayList<>();
        for (JsonNode item : section.path("criteria")) {
            JsonNode requirement = item.get("requirement");
            criteria.add(new RecruiterCriterionView(item.path("key").asString(""),
                    item.path("label").asString(""),
                    requirement == null || requirement.isNull() ? null : requirement.asString(),
                    item.path("weight").asInt(0), item.path("score").asInt(0),
                    item.path("rationale").asString("")));
        }
        return criteria;
    }

    private static CriterionScore criterion(JsonNode root, String key) {
        if (root == null) {
            return null;
        }
        for (JsonNode section : root.path("sections")) {
            for (JsonNode item : section.path("criteria")) {
                if (key.equals(item.path("key").asString())) {
                    return new CriterionScore(item.path("label").asString(key), item.path("score").asInt(0));
                }
            }
        }
        return null;
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

    private record SectionDefinition(String apiValue, String storageValue) {
    }

    private record CriterionScore(String label, int score) {
    }

    private record GapStats(int count, Double averageGap) {
        private static final GapStats NONE = new GapStats(0, null);
    }

    private record PageContext(Map<UUID, User> users, Map<UUID, Candidate> candidates,
            Map<UUID, MatchingResult> latestResults,
            Map<UUID, List<MatchingCriterionFeedback>> feedback,
            Map<UUID, MatchingResult> feedbackResults) {
    }
}
