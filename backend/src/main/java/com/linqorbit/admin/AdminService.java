package com.linqorbit.admin;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.candidate.Candidate;
import com.linqorbit.candidate.CandidateRepository;
import com.linqorbit.candidate.SkillType;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillSuggestion;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers() {
        log.info("Admin users list requested");
        List<User> users = userRepository.findAllByOrderByLastNameAscFirstNameAsc();
        Map<UUID, List<Short>> rolesByUser = userRoleRepository.findAll().stream()
                .collect(Collectors.groupingBy(UserRole::getUserId,
                        Collectors.mapping(UserRole::getRole, Collectors.toList())));
        log.info("Admin users list returned : count={}", users.size());
        return users.stream()
                .map(user -> new AdminUserResponse(
                        user.getId(),
                        user.getEmail(),
                        user.getFirstName(),
                        user.getLastName(),
                        user.getStatus().name(),
                        rolesByUser.getOrDefault(user.getId(), List.of())))
                .toList();
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
}
