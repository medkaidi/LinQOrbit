package com.linqorbit.admin;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.admin.dto.AdminCriterionContextResponse;
import com.linqorbit.admin.dto.AdminCriterionReportDetailResponse;
import com.linqorbit.admin.dto.AdminCriterionReportPageResponse;
import com.linqorbit.admin.dto.AdminCriterionReportResponse;
import com.linqorbit.admin.dto.AdminCriterionReportReviewResponse;
import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferListItem;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserPageResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.CreateCriterionReportReviewRequest;
import com.linqorbit.admin.exception.CriterionReportNotFoundException;
import com.linqorbit.admin.exception.CriterionReportReviewConflictException;
import com.linqorbit.admin.exception.InvalidCriterionReportReviewException;
import com.linqorbit.admin.exception.InvalidOfferStatusFilterException;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserCapabilityFilterException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.NormalizedProfileNotFoundException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.application.dto.RecruiterAssessmentView;
import com.linqorbit.application.dto.RecruiterContestationView;
import com.linqorbit.application.service.ApplicationAssessmentReader;
import com.linqorbit.application.service.ApplicationAssessmentReader.CriterionDetail;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.entity.SkillType;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillSuggestion;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.common.pagination.PageSizes;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.JobOfferAdminView;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.matching.entity.CriterionReportReviewVerdict;
import com.linqorbit.matching.entity.Matching;
import com.linqorbit.matching.entity.MatchingCriterionFeedback;
import com.linqorbit.matching.entity.MatchingCriterionReport;
import com.linqorbit.matching.entity.MatchingCriterionReportReview;
import com.linqorbit.matching.entity.MatchingResult;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportReviewRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;
import com.linqorbit.matching.service.MatchingResultReader;
import com.linqorbit.matching.service.MatchingResultReader.CriterionScore;
import com.linqorbit.recruiter.entity.Recruiter;
import com.linqorbit.recruiter.repository.RecruiterRepository;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Administration : comptes (liste, activation / désactivation) et file de
 * suggestions de compétences (approbation, lien vers un skill existant, rejet —
 * décision appliquée au groupe homonyme). L'identité (candidat / recruteur)
 * reste gérée par ses tables — voir AGENTS « Modèle ».
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    /** Niveau posé en profil : la suggestion ne porte aucun niveau (miroir de l'import CV). */
    private static final int DEFAULT_SKILL_LEVEL = 1;

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final SkillSuggestionRepository skillSuggestionRepository;
    private final SkillRepository skillRepository;
    private final CandidateRepository candidateRepository;
    private final CandidateSkillRepository candidateSkillRepository;
    private final RecruiterRepository recruiterRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final NormalizationJobRepository normalizationJobRepository;
    private final JobOfferRepository jobOfferRepository;
    private final JobOfferService jobOfferService;
    private final CandidateService candidateService;
    private final CompanyRepository companyRepository;
    private final MatchingCriterionReportRepository criterionReportRepository;
    private final MatchingCriterionReportReviewRepository criterionReportReviewRepository;
    private final MatchingCriterionFeedbackRepository feedbackRepository;
    private final MatchingRepository matchingRepository;
    private final MatchingResultRepository matchingResultRepository;
    private final MatchingResultReader matchingResultReader;
    private final ApplicationAssessmentReader assessmentReader;
    private final ObjectMapper objectMapper;

    /**
     * Liste paginée des comptes : tri nom/prénom, pagination bornée par
     * {@link PageSizes} (défaut 20, max 50 — pattern D34). Filtres optionnels
     * (T-48) : {@code q} cherche dans prénom / nom / email, {@code status}
     * (active | inactive) et {@code capability} (candidate | recruiter —
     * identité de profil, jamais un rôle). Rôles et drapeaux d'identité
     * (candidat / recruteur) joints par lot pour la page courante uniquement.
     */
    @Transactional(readOnly = true)
    public AdminUserPageResponse listUsers(String q, String status, String capability, int page,
            Integer size) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        Page<User> result = userRepository.searchUsers(
                userSearchPattern(q), parseUserStatusFilter(status),
                parseUserCapabilityFilter(capability), PageRequest.of(safePage, safeSize));
        List<UUID> userIds = result.getContent().stream().map(User::getId).toList();
        Map<UUID, List<Short>> rolesByUser = userIds.isEmpty() ? Map.of()
                : userRoleRepository.findByUserIdIn(userIds).stream()
                        .collect(Collectors.groupingBy(UserRole::getUserId,
                                Collectors.mapping(UserRole::getRole, Collectors.toList())));
        Set<UUID> candidateIds = userIds.isEmpty() ? Set.of()
                : candidateRepository.findAllById(userIds).stream()
                        .map(Candidate::getId)
                        .collect(Collectors.toSet());
        Set<UUID> recruiterIds = userIds.isEmpty() ? Set.of()
                : recruiterRepository.findAllById(userIds).stream()
                        .map(Recruiter::getId)
                        .collect(Collectors.toSet());
        List<AdminUserResponse> items = result.getContent().stream()
                .map(user -> new AdminUserResponse(
                        user.getId(),
                        user.getEmail(),
                        user.getFirstName(),
                        user.getLastName(),
                        user.getStatus().name(),
                        rolesByUser.getOrDefault(user.getId(), List.of()),
                        candidateIds.contains(user.getId()),
                        recruiterIds.contains(user.getId())))
                .toList();
        log.info("Admin users list returned : page={}, size={}, q={}, status={}, capability={}, count={}, total={}",
                safePage, safeSize, q, status, capability, items.size(), result.getTotalElements());
        return new AdminUserPageResponse(items, result.getNumber(), result.getSize(),
                result.getTotalElements());
    }

    @Transactional
    public void updateUserStatus(UUID userId, UserStatus status, UUID adminId) {
        log.info("Admin status update requested : userId={}, status={}, adminId={}", userId, status, adminId);
        if (status != UserStatus.ACTIVE && status != UserStatus.INACTIVE) {
            log.warn("Admin status update rejected : unsupported status, userId={}, status={}", userId, status);
            throw new InvalidUserStatusException(status);
        }
        if (userId.equals(adminId)) {
            log.warn("Admin status update rejected : admin cannot change own status, adminId={}", adminId);
            throw new SelfStatusChangeException();
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("Admin status update rejected : user not found, userId={}", userId);
            throw new UserNotFoundException(userId);
        }
        user.setStatus(status);
        userRepository.save(user);
        log.info("Admin status updated : userId={}, status={}, adminId={}", userId, status, adminId);
    }

    @Transactional(readOnly = true)
    public List<AdminSkillSuggestionResponse> listSkillSuggestions() {
        log.info("Admin skill suggestions requested");
        List<SkillSuggestion> suggestions = skillSuggestionRepository.findAllByOrderByCreatedAtDesc();
        Map<UUID, User> authors = userRepository.findAllById(
                        suggestions.stream().map(SkillSuggestion::getCandidateId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(User::getId, author -> author));
        log.info("Admin skill suggestions returned : count={}", suggestions.size());
        return suggestions.stream()
                .map(suggestion -> {
                    User author = authors.get(suggestion.getCandidateId());
                    return new AdminSkillSuggestionResponse(
                            suggestion.getId(),
                            suggestion.getName(),
                            suggestion.getCandidateId(),
                            author == null ? null : author.getFirstName(),
                            author == null ? null : author.getLastName(),
                            author == null ? null : author.getEmail(),
                            suggestion.getCreatedAt());
                })
                .toList();
    }

    /**
     * Approbation : crée la compétence au catalogue (sauf si le nom y est déjà),
     * l'insère au profil (niveau 1) de chaque auteur du groupe homonyme et retire
     * tout le groupe de la file.
     */
    @Transactional
    public void approveSuggestion(UUID suggestionId, String category, String skillType, UUID adminId) {
        log.info("Admin suggestion approve requested : suggestionId={}, category={}, skillType={}, adminId={}",
                suggestionId, category, skillType, adminId);
        SkillSuggestion suggestion = findSuggestion(suggestionId);
        String name = suggestion.getName().trim();
        SkillType type = parseSkillType(skillType);
        String normalizedCategory = validateCategory(category);
        List<SkillSuggestion> group = skillSuggestionRepository.findAllByNameIgnoreCase(name);
        Skill skill = skillRepository.findByNameIgnoreCase(name).orElse(null);
        if (skill == null) {
            skill = skillRepository.save(Skill.builder()
                    .name(name)
                    .skillType(type)
                    .category(normalizedCategory)
                    .build());
            log.info("Admin suggestion approved : catalogue entry created, skillId={}, name={}", skill.getId(), name);
        } else {
            log.warn("Admin suggestion approved : already in catalogue, skillId={}, name={}", skill.getId(), name);
        }
        int granted = grantSkillToAuthors(group, skill);
        skillSuggestionRepository.deleteAll(group);
        log.info("Admin suggestion approved : suggestionId={}, name={}, resolved={}, granted={}, adminId={}",
                suggestionId, name, group.size(), granted, adminId);
    }

    /**
     * Lien : branche le skill catalogue choisi dans le profil (niveau 1) de chaque
     * auteur du groupe homonyme et retire le groupe de la file — ni création ni
     * suppression dans le catalogue.
     */
    @Transactional
    public void linkSuggestion(UUID suggestionId, UUID skillId, UUID adminId) {
        log.info("Admin suggestion link requested : suggestionId={}, skillId={}, adminId={}",
                suggestionId, skillId, adminId);
        SkillSuggestion suggestion = findSuggestion(suggestionId);
        String name = suggestion.getName().trim();
        Skill skill = skillRepository.findById(skillId).orElseThrow(() -> {
            log.warn("Admin suggestion link rejected : unknown skill, skillId={}", skillId);
            return new ReferenceNotFoundException("Skill", skillId);
        });
        List<SkillSuggestion> group = skillSuggestionRepository.findAllByNameIgnoreCase(name);
        int granted = grantSkillToAuthors(group, skill);
        skillSuggestionRepository.deleteAll(group);
        log.info("Admin suggestion linked : suggestionId={}, name={}, skillId={}, resolved={}, granted={}, adminId={}",
                suggestionId, name, skillId, group.size(), granted, adminId);
    }

    /** Rejet : retire de la file le groupe homonyme, sans toucher aux profils. */
    @Transactional
    public void rejectSuggestion(UUID suggestionId, UUID adminId) {
        log.info("Admin suggestion reject requested : suggestionId={}, adminId={}", suggestionId, adminId);
        SkillSuggestion suggestion = findSuggestion(suggestionId);
        String name = suggestion.getName().trim();
        List<SkillSuggestion> group = skillSuggestionRepository.findAllByNameIgnoreCase(name);
        skillSuggestionRepository.deleteAll(group);
        log.info("Admin suggestion rejected : suggestionId={}, name={}, resolved={}, adminId={}",
                suggestionId, name, group.size(), adminId);
    }

    private SkillSuggestion findSuggestion(UUID suggestionId) {
        return skillSuggestionRepository.findById(suggestionId).orElseThrow(() -> {
            log.warn("Admin suggestion rejected : unknown suggestion, suggestionId={}", suggestionId);
            return new SuggestionNotFoundException(suggestionId);
        });
    }

    private SkillType parseSkillType(String skillType) {
        String normalized = skillType == null ? "" : skillType.trim();
        for (SkillType type : SkillType.values()) {
            if (type.getApiValue().equalsIgnoreCase(normalized)) {
                return type;
            }
        }
        log.warn("Admin suggestion rejected : invalid skill type, skillType={}", skillType);
        throw new InvalidSkillTypeException(skillType);
    }

    private String validateCategory(String category) {
        String normalized = category == null ? "" : category.trim();
        boolean known = skillRepository.findAll().stream()
                .anyMatch(skill -> normalized.equals(skill.getCategory()));
        if (!known) {
            log.warn("Admin suggestion rejected : unknown category, category={}", normalized);
            throw new InvalidSkillCategoryException(normalized);
        }
        return normalized;
    }

    /** Insère la compétence au profil de chaque auteur (unicité du couple, niveau 1). */
    private int grantSkillToAuthors(List<SkillSuggestion> group, Skill skill) {
        Set<UUID> candidateIds = group.stream()
                .map(SkillSuggestion::getCandidateId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        int granted = 0;
        for (UUID candidateId : candidateIds) {
            if (candidateSkillRepository.existsByCandidateIdAndSkillId(candidateId, skill.getId())) {
                log.info("Admin suggestion grant skipped : already in profile, candidateId={}, skillId={}",
                        candidateId, skill.getId());
                continue;
            }
            Candidate candidate = candidateRepository.findById(candidateId).orElse(null);
            if (candidate == null) {
                log.warn("Admin suggestion grant skipped : candidate not found, candidateId={}", candidateId);
                continue;
            }
            candidateSkillRepository.save(CandidateSkill.builder()
                    .candidate(candidate)
                    .skill(skill)
                    .level(DEFAULT_SKILL_LEVEL)
                    .yearsExperience(null)
                    .build());
            granted++;
        }
        return granted;
    }

    /**
     * Fiche détail d'un compte (D33) : identité complète saisie par
     * l'utilisateur (jamais le hash du mot de passe), statut, rôles de
     * capacité et drapeaux candidat / recruteur.
     */
    @Transactional(readOnly = true)
    public AdminUserDetailResponse getUserDetail(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        List<Short> roles = userRoleRepository.findByUserId(userId).stream()
                .map(UserRole::getRole)
                .toList();
        return new AdminUserDetailResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getStatus().name(),
                roles,
                user.getPhone(),
                user.getSex() == null ? null : user.getSex().getApiValue(),
                user.getHomeCountry(),
                user.getCurrentCity(),
                user.getCurrentCountry(),
                user.getCreatedAt(),
                candidateRepository.existsById(userId),
                recruiterRepository.existsById(userId));
    }

    /**
     * Profil professionnel d'un candidat (D38) : même payload que la vue du
     * candidat lui-même (sections, complétion, signaux de normalisation),
     * assemblé en lecture seule par {@link CandidateService}. 404 si le compte
     * n'existe pas ou n'est pas un candidat (miroir de la fiche normalisée).
     */
    @Transactional(readOnly = true)
    public CandidateProfileResponse getCandidateProfile(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new UserNotFoundException(candidateId);
        }
        log.info("Admin candidate profile read : candidateId={}", candidateId);
        return candidateService.getProfile(candidateId);
    }

    /**
     * Fiche normalisée d'un candidat (D33) : dernière version produite +
     * statut du job associé + contenu pass-through (JsonNode). 404 si le
     * compte n'est pas un candidat ou si aucune validation n'a encore produit
     * de fiche.
     */
    @Transactional(readOnly = true)
    public AdminNormalizedProfileResponse getCandidateNormalizedProfile(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new UserNotFoundException(candidateId);
        }
        List<NormalizedProfile> latest = normalizedProfileRepository
                .findLatestByCandidateId(candidateId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            throw new NormalizedProfileNotFoundException(true);
        }
        return toNormalizedResponse(latest.get(0));
    }

    /**
     * Historique des fiches normalisées d'un candidat (D37) : toutes les
     * versions produites, de la plus récente à la plus ancienne, chacune avec
     * son statut de job et son contenu pass-through. 404 mêmes cas que la fiche
     * courante (compte introuvable ou aucune fiche).
     */
    @Transactional(readOnly = true)
    public List<AdminNormalizedProfileResponse> getCandidateNormalizedProfileVersions(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new UserNotFoundException(candidateId);
        }
        List<NormalizedProfile> versions = normalizedProfileRepository
                .findLatestByCandidateId(candidateId, Pageable.unpaged());
        if (versions.isEmpty()) {
            throw new NormalizedProfileNotFoundException(true);
        }
        return versions.stream().map(this::toNormalizedResponse).toList();
    }

    /**
     * Fiche normalisée d'une offre (D33) : dernière version produite + statut
     * du job associé + contenu pass-through (JsonNode). 404 si l'offre
     * n'existe pas ou si aucune validation n'a encore produit de fiche.
     */
    @Transactional(readOnly = true)
    public AdminNormalizedProfileResponse getOfferNormalizedProfile(UUID offerId) {
        if (!jobOfferRepository.existsById(offerId)) {
            throw new JobOfferNotFoundException("Job offer not found.");
        }
        List<NormalizedProfile> latest = normalizedProfileJobOfferRepository
                .findLatestByOfferId(offerId, PageRequest.of(0, 1));
        if (latest.isEmpty()) {
            throw new NormalizedProfileNotFoundException(false);
        }
        return toNormalizedResponse(latest.get(0));
    }

    /**
     * Historique des fiches normalisées d'une offre (D37) : toutes les
     * versions produites, de la plus récente à la plus ancienne, chacune avec
     * son statut de job et son contenu pass-through. 404 mêmes cas que la fiche
     * courante (offre introuvable ou aucune fiche).
     */
    @Transactional(readOnly = true)
    public List<AdminNormalizedProfileResponse> getOfferNormalizedProfileVersions(UUID offerId) {
        if (!jobOfferRepository.existsById(offerId)) {
            throw new JobOfferNotFoundException("Job offer not found.");
        }
        List<NormalizedProfile> versions = normalizedProfileJobOfferRepository
                .findLatestByOfferId(offerId, Pageable.unpaged());
        if (versions.isEmpty()) {
            throw new NormalizedProfileNotFoundException(false);
        }
        return versions.stream().map(this::toNormalizedResponse).toList();
    }

    /**
     * Liste globale des offres (D33, bornes D34) : toutes les offres du
     * système, filtre de statut optionnel (draft|validated|published|closed),
     * pagination bornée par {@link PageSizes} (défaut 20, max 50), tri
     * createdAt décroissant. Chaque ligne porte le statut du job de
     * normalisation (anti-N+1).
     */
    @Transactional(readOnly = true)
    public AdminJobOfferPageResponse listJobOffers(String status, int page, Integer size) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<JobOffer> result = (status == null || status.isBlank())
                ? jobOfferRepository.findAll(pageable)
                : jobOfferRepository.findByStatus(parseOfferStatus(status), pageable);
        List<JobOffer> offers = result.getContent();
        Map<UUID, String> companyNames = companyNamesOf(offers);
        Map<UUID, NormalizationJobStatus> jobStatuses = latestOfferJobStatuses(offers);
        List<AdminJobOfferListItem> items = offers.stream()
                .map(offer -> new AdminJobOfferListItem(
                        offer.getId(),
                        offer.getTitle(),
                        offer.getStatus().getApiValue(),
                        companyNames.get(offer.getCompanyId()),
                        offer.getPublicId(),
                        offer.getSlug(),
                        offer.getCreatedAt(),
                        offer.getUpdatedAt(),
                        offer.getExpiresAt(),
                        offer.getPublishedAt(),
                        offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                        offer.getCity(),
                        offer.getCountry(),
                        offer.getContractTypeId(),
                        offer.getWorkModeId(),
                        offer.getSalaryMin(),
                        offer.getSalaryMax(),
                        offer.getSalaryCurrency(),
                        offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                        // Même règle que la liste recruteur (buildListItems) : le
                        // dirty-flag n'a de sens que sur un statut éditable.
                        (offer.getStatus() == JobOfferStatus.DRAFT
                                 || offer.getStatus() == JobOfferStatus.VALIDATED)
                                 && offer.getValidatedAt() != null
                                 && offer.getUpdatedAt() != null
                                 && offer.getUpdatedAt().isAfter(offer.getValidatedAt()),
                        jobStatuses.containsKey(offer.getId())
                                ? jobStatuses.get(offer.getId()).name().toLowerCase(Locale.ROOT)
                                : null))
                .toList();
        return new AdminJobOfferPageResponse(
                items, result.getNumber(), result.getSize(), result.getTotalElements());
    }

    /**
     * Signalements internes d'évaluations IA (T-86, D66), du plus récent au
     * plus ancien. La page est lue par lots (matchings, résultats, offres,
     * companies, comptes) : jamais une requête par signalement.
     *
     * <p>Le libellé du critère, sa section et ses scores sont relus dans le
     * JSON du résultat épinglé — la console lit exactement l'évaluation vue
     * par le recruteur, rien n'est dénormalisé.</p>
     */
    @Transactional(readOnly = true)
    public AdminCriterionReportPageResponse listCriterionReports(int page, Integer size) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        Page<MatchingCriterionReport> result = criterionReportRepository
                .findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(safePage, safeSize));
        List<MatchingCriterionReport> reports = result.getContent();
        if (reports.isEmpty()) {
            return new AdminCriterionReportPageResponse(List.of(), safePage, safeSize,
                    result.getTotalElements());
        }

        Map<UUID, Matching> matchings = byId(matchingRepository,
                reports.stream().map(MatchingCriterionReport::getMatchingId).toList(), Matching::getId);
        Map<UUID, MatchingResult> results = byId(matchingResultRepository,
                reports.stream().map(MatchingCriterionReport::getMatchingResultId).toList(),
                MatchingResult::getId);
        Map<UUID, JobOffer> offers = byId(jobOfferRepository,
                matchings.values().stream().map(Matching::getJobOfferId).distinct().toList(), JobOffer::getId);
        Map<UUID, Company> companies = byId(companyRepository,
                offers.values().stream().map(JobOffer::getCompanyId).distinct().toList(), Company::getId);
        Map<UUID, User> users = byId(userRepository, Stream.concat(
                        reports.stream().map(MatchingCriterionReport::getAuthorUserId),
                        matchings.values().stream().map(Matching::getCandidateId))
                .distinct().toList(), User::getId);

        List<AdminCriterionReportResponse> items = reports.stream()
                .map(report -> {
                    Matching matching = matchings.get(report.getMatchingId());
                    MatchingResult matchingResult = results.get(report.getMatchingResultId());
                    JobOffer offer = matching == null ? null
                            : offers.get(matching.getJobOfferId());
                    Company company = offer == null ? null : companies.get(offer.getCompanyId());
                    User author = users.get(report.getAuthorUserId());
                    User candidate = matching == null ? null : users.get(matching.getCandidateId());
                    return reportResponse(report, matchingResultReader.tree(matchingResult), matching, offer,
                            company, author, candidate);
                })
                .toList();
        log.info("Admin criterion reports served : page={}, size={}, count={}, total={}",
                safePage, safeSize, items.size(), result.getTotalElements());
        return new AdminCriterionReportPageResponse(
                items, result.getNumber(), result.getSize(), result.getTotalElements());
    }

    /**
     * Dossier d'un signalement (T-86, D66) : le signalement, le critère relu
     * dans <b>le résultat épinglé</b> (celui qui a été signalé, pas le dernier),
     * l'évaluation complète et les contestations du candidat.
     */
    @Transactional(readOnly = true)
    public AdminCriterionReportDetailResponse getCriterionReport(UUID reportId, UUID reviewerUserId) {
        MatchingCriterionReport report = criterionReportRepository.findById(reportId)
                .orElseThrow(() -> new CriterionReportNotFoundException(reportId));
        // Aveugle total : la requête ne peut renvoyer que l'avis de l'admin
        // courant — jamais la liste, un compteur ou l'existence d'un autre avis.
        MatchingCriterionReportReview myReview = criterionReportReviewRepository
                .findByReportIdAndReviewerUserId(reportId, reviewerUserId)
                .orElse(null);
        Matching matching = matchingRepository.findById(report.getMatchingId()).orElse(null);
        MatchingResult pinned = matchingResultRepository.findById(report.getMatchingResultId()).orElse(null);
        JobOffer offer = matching == null ? null
                : jobOfferRepository.findById(matching.getJobOfferId()).orElse(null);
        Company company = offer == null ? null
                : companyRepository.findById(offer.getCompanyId()).orElse(null);
        User author = userRepository.findById(report.getAuthorUserId()).orElse(null);
        User candidate = matching == null ? null
                : userRepository.findById(matching.getCandidateId()).orElse(null);

        JsonNode root = assessmentReader.tree(pinned);
        AdminCriterionReportResponse item = reportResponse(report, root, matching, offer, company,
                author, candidate);
        // Provenance du résultat, indépendante de la résolution du critère :
        // un ancien résultat ou une analyse déterministe n'a pas de modèle.
        String modelName = matchingResultReader.modelName(root);
        CriterionDetail detail = assessmentReader.criterionDetail(root, report.getCriterionKey());
        AdminCriterionContextResponse criterion = detail == null
                ? new AdminCriterionContextResponse(report.getCriterionKey(), report.getCriterionKey(),
                        null, null, null, null, null, modelName, false)
                : new AdminCriterionContextResponse(detail.criterion().key(), detail.criterion().label(),
                        detail.section(), detail.criterion().score(), detail.sectionScore(),
                        detail.criterion().requirement(), detail.criterion().rationale(), modelName, true);

        // Latest-only : les contestations affichées sont celles du dernier
        // résultat terminé, jamais celles d'un ancien résultat épinglé. Le
        // critère du dossier, lui, reste celui du résultat signalé.
        MatchingResult latest = matching == null ? pinned
                : matchingResultRepository
                        .findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(matching.getId())
                        .orElse(pinned);
        List<MatchingCriterionFeedback> feedback = latest == null ? List.of()
                : feedbackRepository.findByMatchingResultIdOrderByCriterionKeyAsc(latest.getId());
        Map<UUID, MatchingResult> feedbackResults = assessmentReader.feedbackResults(feedback);
        List<RecruiterContestationView> contests = assessmentReader.contests(feedback, feedbackResults);
        ApplicationAssessmentReader.GapStats gap = assessmentReader.gapStats(feedback, feedbackResults);
        RecruiterAssessmentView assessment = assessmentReader.assessment(root);

        log.info("Admin criterion report served : reportId={}, matchingId={}, resolved={}",
                reportId, report.getMatchingId(), criterion.resolved());
        return new AdminCriterionReportDetailResponse(item,
                matching == null ? null : matching.getCandidateId(), criterion, assessment, contests,
                gap.averageGap(),
                myReview == null && !report.getAuthorUserId().equals(reviewerUserId),
                myReview == null ? null : reviewResponse(myReview));
    }

    /**
     * Enregistre l'avis final de l'admin courant sur un signalement (T-96,
     * D77/D78). Un seul avis par admin et par signalement, auto-review
     * interdite, aucun update/delete. L'avis est aveugle, immuable et sans
     * effet sur le signalement, le résultat, le score ou la décision.
     */
    @Transactional
    public AdminCriterionReportReviewResponse createCriterionReportReview(UUID reportId,
            UUID reviewerUserId, CreateCriterionReportReviewRequest request) {
        MatchingCriterionReport report = criterionReportRepository.findById(reportId)
                .orElseThrow(() -> new CriterionReportNotFoundException(reportId));
        log.info("Admin criterion report review requested : reportId={}, reviewerUserId={}",
                reportId, reviewerUserId);

        if (report.getAuthorUserId().equals(reviewerUserId)) {
            log.warn("Admin criterion report review rejected : self review, reportId={}, reviewerUserId={}",
                    reportId, reviewerUserId);
            throw new CriterionReportReviewConflictException("You cannot review your own report.");
        }
        if (criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerUserId)) {
            log.warn("Admin criterion report review rejected : already reviewed, reportId={}, reviewerUserId={}",
                    reportId, reviewerUserId);
            throw new CriterionReportReviewConflictException("You have already reviewed this report.");
        }

        CriterionReportReviewVerdict verdict = parseReviewVerdict(request.verdict());
        String note = normalizeReviewText(request.note(), "Note");
        String correctedRationale = normalizeReviewText(request.correctedRationale(),
                "Corrected rationale");
        if (!verdict.allowsCorrection()
                && (request.correctedScore() != null || correctedRationale != null)) {
            log.warn("Admin criterion report review rejected : correction with notUpheld, reportId={}, reviewerUserId={}",
                    reportId, reviewerUserId);
            throw new InvalidCriterionReportReviewException(
                    "Corrected score and rationale are only allowed when the report is upheld.");
        }
        validateCorrectedScore(request.correctedScore());

        MatchingCriterionReportReview review = MatchingCriterionReportReview.builder()
                .id(UUID.randomUUID())
                .reportId(reportId)
                .reviewerUserId(reviewerUserId)
                .verdict(verdict)
                .note(note)
                .correctedScore(request.correctedScore())
                .correctedRationale(correctedRationale)
                // Renseigné dès la construction pour que la réponse 201 porte
                // toujours la date, même si le provider JPA ne réalimente pas
                // le champ après l'insert.
                .createdAt(LocalDateTime.now())
                .build();
        try {
            criterionReportReviewRepository.saveAndFlush(review);
        } catch (DataIntegrityViolationException ex) {
            // Course entre deux avis du même admin sur le même signalement :
            // l'unicité de la base tranche, jamais une 500.
            log.warn("Admin criterion report review rejected : concurrent duplicate, reportId={}, reviewerUserId={}",
                    reportId, reviewerUserId);
            throw new CriterionReportReviewConflictException("You have already reviewed this report.");
        }
        log.info("Admin criterion report review recorded : reportId={}, reviewerUserId={}, verdict={}",
                reportId, reviewerUserId, verdict.getApiValue());
        return reviewResponse(review);
    }

    private static CriterionReportReviewVerdict parseReviewVerdict(String verdict) {
        if (verdict == null || verdict.isBlank()) {
            throw new InvalidCriterionReportReviewException(
                    "Verdict must be upheld or notUpheld.");
        }
        String value = verdict.trim();
        for (CriterionReportReviewVerdict candidate : CriterionReportReviewVerdict.values()) {
            if (candidate.getApiValue().equals(value)) {
                return candidate;
            }
        }
        throw new InvalidCriterionReportReviewException("Verdict must be upheld or notUpheld.");
    }

    /** Texte nettoyé : blanc ou absent → {@code null} (jamais une chaîne vide). */
    private static String normalizeReviewText(String value, String fieldLabel) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > 2000) {
            throw new InvalidCriterionReportReviewException(
                    fieldLabel + " must not exceed 2000 characters.");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void validateCorrectedScore(Integer correctedScore) {
        if (correctedScore != null && (correctedScore < 0 || correctedScore > 100)) {
            throw new InvalidCriterionReportReviewException(
                    "Corrected score must be between 0 and 100.");
        }
    }

    private static AdminCriterionReportReviewResponse reviewResponse(
            MatchingCriterionReportReview review) {
        return new AdminCriterionReportReviewResponse(
                review.getId(),
                review.getVerdict().getApiValue(),
                review.getNote(),
                review.getCorrectedScore(),
                review.getCorrectedRationale(),
                review.getCreatedAt());
    }

    /** Ligne de signalement, partagée par la liste et le dossier (même contrat). */
    private AdminCriterionReportResponse reportResponse(MatchingCriterionReport report, JsonNode root,
            Matching matching, JobOffer offer, Company company, User author, User candidate) {
        CriterionScore criterion = matchingResultReader.criterion(root, report.getCriterionKey());
        return new AdminCriterionReportResponse(
                report.getId(),
                report.getCriterionKey(),
                criterion == null ? report.getCriterionKey() : criterion.label(),
                criterion == null || criterion.section() == null
                        ? null : criterion.section().getSectionKey(),
                criterion == null ? null : criterion.score(),
                criterion == null ? null : criterion.sectionScore(),
                report.getReason().getApiValue(),
                report.getComment(),
                report.getCreatedAt(),
                author == null ? null : author.getFirstName(),
                author == null ? null : author.getLastName(),
                author == null ? null : author.getEmail(),
                candidate == null ? null : candidate.getFirstName(),
                candidate == null ? null : candidate.getLastName(),
                offer == null ? null : offer.getId(),
                offer == null ? null : offer.getTitle(),
                company == null ? null : company.getName());
    }

    /** Lecture par lots : une requête par type, jamais une requête par ligne. */
    private static <T> Map<UUID, T> byId(JpaRepository<T, UUID> repository, List<UUID> ids,
            Function<T, UUID> idOf) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, T> entities = new HashMap<>();
        repository.findAllById(ids).forEach(entity -> entities.put(idOf.apply(entity), entity));
        return entities;
    }

    /**
     * Détail d'une offre (D33) : la fiche publique (labels résolus, HTML
     * sanitisé) sans la gate published / non expirée, augmentée de
     * l'identifiant, du statut de vie et des horodatages.
     */
    @Transactional(readOnly = true)
    public AdminJobOfferDetailResponse getJobOfferDetail(UUID offerId) {
        JobOfferAdminView view = jobOfferService.getAdminView(offerId);
        return new AdminJobOfferDetailResponse(
                view.id(), view.status(), view.createdAt(), view.updatedAt(), view.detail());
    }

    private AdminNormalizedProfileResponse toNormalizedResponse(NormalizedProfile profile) {
        String jobStatus = normalizationJobRepository.findById(profile.getId())
                .map(job -> job.getStatus().name().toLowerCase(Locale.ROOT))
                .orElse(null);
        JsonNode content = null;
        if (profile.getContent() != null) {
            try {
                content = objectMapper.readTree(profile.getContent());
            } catch (Exception ex) {
                log.error("Admin normalized profile content unparsable : profileId={}",
                        profile.getId(), ex);
            }
        }
        return new AdminNormalizedProfileResponse(
                profile.getId(),
                profile.getVersion(),
                profile.getSchemaVersion(),
                profile.getValidatedAt(),
                jobStatus,
                content);
    }

    private JobOfferStatus parseOfferStatus(String status) {
        try {
            return JobOfferStatus.fromApiValue(status.trim().toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new InvalidOfferStatusFilterException(status);
        }
    }

    /**
     * Recherche vide ou absente → null (pas de filtre) ; sinon motif LIKE
     * « %terme% » en minuscules — construit ici, pas dans le JPQL : un
     * paramètre brut concaténé à des littéraux n'a pas de type inférable et
     * PostgreSQL le résout mal quand il vaut null.
     */
    private String userSearchPattern(String q) {
        return (q == null || q.isBlank()) ? null : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
    }

    /** Filtre de statut de la liste des comptes : active | inactive (jamais SUSPENDED). */
    private UserStatus parseUserStatusFilter(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String value = status.trim().toLowerCase(Locale.ROOT);
        if ("active".equals(value)) {
            return UserStatus.ACTIVE;
        }
        if ("inactive".equals(value)) {
            return UserStatus.INACTIVE;
        }
        throw new InvalidUserStatusException(status);
    }

    /** Filtre de capacité de la liste des comptes : candidate | recruiter. */
    private String parseUserCapabilityFilter(String capability) {
        if (capability == null || capability.isBlank()) {
            return null;
        }
        String value = capability.trim().toLowerCase(Locale.ROOT);
        if (!"candidate".equals(value) && !"recruiter".equals(value)) {
            throw new InvalidUserCapabilityFilterException(capability);
        }
        return value;
    }

    private Map<UUID, String> companyNamesOf(List<JobOffer> offers) {
        if (offers.isEmpty()) {
            return Map.of();
        }
        Set<UUID> companyIds = offers.stream()
                .map(JobOffer::getCompanyId)
                .collect(Collectors.toSet());
        return companyRepository.findAllById(companyIds).stream()
                .collect(Collectors.toMap(Company::getId, Company::getName));
    }

    private Map<UUID, NormalizationJobStatus> latestOfferJobStatuses(List<JobOffer> offers) {
        if (offers.isEmpty()) {
            return Map.of();
        }
        List<UUID> offerIds = offers.stream().map(JobOffer::getId).toList();
        Map<UUID, NormalizationJobStatus> statuses = new HashMap<>();
        for (Object[] row : normalizedProfileJobOfferRepository.findLatestJobStatuses(offerIds)) {
            statuses.put((UUID) row[0], (NormalizationJobStatus) row[1]);
        }
        return statuses;
    }
}
