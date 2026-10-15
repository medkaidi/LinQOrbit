package com.linqorbit.admin;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferListItem;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserPageResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidOfferStatusFilterException;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.NormalizedProfileNotFoundException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
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
    private final ObjectMapper objectMapper;

    /**
     * Liste paginée des comptes : tri nom/prénom, pagination bornée par
     * {@link PageSizes} (défaut 20, max 50 — pattern D34). Rôles et drapeaux
     * d'identité (candidat / recruteur) joints par lot pour la page courante
     * uniquement.
     */
    @Transactional(readOnly = true)
    public AdminUserPageResponse listUsers(int page, Integer size) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        Page<User> result = userRepository.findAllByOrderByLastNameAscFirstNameAsc(
                PageRequest.of(safePage, safeSize));
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
        log.info("Admin users list returned : page={}, size={}, count={}, total={}",
                safePage, safeSize, items.size(), result.getTotalElements());
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
            return JobOfferStatus.fromApiValue(status.trim());
        } catch (IllegalArgumentException ex) {
            throw new InvalidOfferStatusFilterException(status);
        }
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
