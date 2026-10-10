package com.linqorbit.candidate.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.candidate.dto.AboutRequest;
import com.linqorbit.candidate.dto.AboutResponse;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.DegreeOption;
import com.linqorbit.candidate.dto.DiplomaRequest;
import com.linqorbit.candidate.dto.DiplomaResponse;
import com.linqorbit.candidate.dto.ExperienceRequest;
import com.linqorbit.candidate.dto.ExperienceResponse;
import com.linqorbit.candidate.dto.LanguageOption;
import com.linqorbit.candidate.dto.LanguageRequest;
import com.linqorbit.candidate.dto.LanguageResponse;
import com.linqorbit.candidate.dto.LinkRequest;
import com.linqorbit.candidate.dto.LinkResponse;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillRequest;
import com.linqorbit.candidate.dto.SkillResponse;
import com.linqorbit.candidate.dto.SkillSuggestionRequest;
import com.linqorbit.candidate.dto.StudyFieldOption;
import com.linqorbit.candidate.dto.TargetPositionRequest;
import com.linqorbit.candidate.entity.CandidateLanguage;
import com.linqorbit.candidate.entity.CandidateLink;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Diploma;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.ProfessionalExperience;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillSuggestion;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.exception.InvalidProfileSectionException;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.mapper.CandidateMapper;
import com.linqorbit.candidate.repository.CandidateLanguageRepository;
import com.linqorbit.candidate.repository.CandidateLinkRepository;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.DiplomaRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.ProfessionalExperienceRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.LinkType;
import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.candidate.repository.CandidateRepository;

/**
 * Profil candidat : lecture agrégée, écriture section par section (remplacement
 * complet de la liste) et calcul du taux de complétion.
 * La ligne candidates est créée à la première écriture, jamais à la lecture.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateService {

    private static final int COMPLETION_SECTIONS = 6;

    private final CandidateRepository candidateRepository;
    private final ProfessionalExperienceRepository experienceRepository;
    private final DiplomaRepository diplomaRepository;
    private final CandidateSkillRepository candidateSkillRepository;
    private final CandidateLanguageRepository candidateLanguageRepository;
    private final CandidateLinkRepository candidateLinkRepository;
    private final SkillRepository skillRepository;
    private final LanguageRepository languageRepository;
    private final DegreeRepository degreeRepository;
    private final StudyFieldRepository studyFieldRepository;
    private final SkillSuggestionRepository skillSuggestionRepository;
    private final CandidateMapper candidateMapper;
    private final NormalizationService normalizationService;

    @Transactional(readOnly = true)
    public CandidateProfileResponse getProfile(UUID userId) {
        log.info("Candidate profile read requested : userId={}", userId);
        Candidate candidate = candidateRepository.findById(userId).orElse(null);
        if (candidate == null) {
            log.info("Candidate profile read : no profile yet, empty payload returned, userId={}", userId);
            return emptyProfile();
        }

        AboutResponse about = candidateMapper.toAboutResponse(candidate);
        List<ExperienceResponse> experiences = experienceRepository
                .findByCandidateIdOrderBySortOrderAsc(userId).stream()
                .map(candidateMapper::toExperienceResponse).toList();
        List<DiplomaResponse> diplomas = diplomaRepository.findByCandidateId(userId).stream()
                .map(candidateMapper::toDiplomaResponse).toList();
        List<SkillResponse> skills = candidateSkillRepository.findByCandidateId(userId).stream()
                .map(candidateMapper::toSkillResponse).toList();
        List<LanguageResponse> languages = candidateLanguageRepository.findByCandidateId(userId).stream()
                .map(candidateMapper::toLanguageResponse).toList();
        List<LinkResponse> links = candidateLinkRepository.findByCandidateIdOrderBySortOrderAsc(userId).stream()
                .map(candidateMapper::toLinkResponse).toList();

        int completion = computeCompletion(about, experiences, diplomas, skills, languages, links);
        boolean hasUnvalidatedChanges = normalizationService.hasUnvalidatedChanges(candidate);
        boolean normalizationFailed = normalizationService.hasFailedLatestJob(userId);
        boolean normalizationInProgress = normalizationService.hasInProgressLatestJob(userId);
        log.info("Candidate profile read succeeded : userId={}, completion={}%, normalizationFailed={},"
                        + " normalizationInProgress={}",
                userId, completion, normalizationFailed, normalizationInProgress);
        return new CandidateProfileResponse(about, experiences, diplomas, skills, languages, links,
                completion, hasUnvalidatedChanges, normalizationFailed, normalizationInProgress);
    }

    @Transactional
    public void updateAbout(UUID userId, AboutRequest request) {
        log.info("Candidate profile about update requested : userId={}", userId);
        SearchStatus searchStatus = parseSearchStatus(request.searchStatus());
        Candidate candidate = candidateRepository.findById(userId)
                .orElseGet(() -> Candidate.builder().id(userId).build());
        candidate.setTitle(request.title().trim());
        candidate.setBio(trimToNull(request.bio()));
        candidate.setYearsOfExperience(request.yearsOfExperience());
        candidate.setSearchStatus(searchStatus);
        candidateRepository.save(candidate);
        log.info("Candidate profile about updated : userId={}, title={}", userId, candidate.getTitle());
    }

    @Transactional
    public void updateTargetPosition(UUID userId, TargetPositionRequest request) {
        log.info("Candidate profile target position update requested : userId={}", userId);
        Candidate candidate = findOrCreate(userId);
        candidate.setTargetPosition(trimToNull(request.targetPosition()));
        candidateRepository.save(candidate);
        log.info("Candidate profile target position updated : userId={}, targetPosition={}",
                userId, candidate.getTargetPosition());
    }

    @Transactional
    public void updateExperiences(UUID userId, List<ExperienceRequest> requests) {
        log.info("Candidate profile experiences update requested : userId={}, count={}", userId, requests.size());
        Candidate candidate = findOrCreate(userId);
        List<ProfessionalExperience> experiences = new ArrayList<>(requests.size());
        for (int i = 0; i < requests.size(); i++) {
            ExperienceRequest request = requests.get(i);
            validateDates(request.startDate(), request.endDate(), "experience");
            experiences.add(ProfessionalExperience.builder()
                    .candidate(candidate)
                    .positionTitle(request.positionTitle().trim())
                    .description(trimToNull(request.description()))
                    .startDate(request.startDate())
                    .endDate(request.endDate())
                    .companyName(request.companyName().trim())
                    .companyCountry(normalizeCountry(request.companyCountry()))
                    .sortOrder(i)
                    .build());
        }
        experienceRepository.deleteAllByCandidateId(userId);
        experienceRepository.saveAll(experiences);
        touchUpdatedAt(candidate);
        log.info("Candidate profile experiences updated : userId={}, count={}", userId, experiences.size());
    }

    @Transactional
    public void updateDiplomas(UUID userId, List<DiplomaRequest> requests) {
        log.info("Candidate profile diplomas update requested : userId={}, count={}", userId, requests.size());
        Candidate candidate = findOrCreate(userId);
        List<Diploma> diplomas = new ArrayList<>(requests.size());
        for (int i = 0; i < requests.size(); i++) {
            DiplomaRequest request = requests.get(i);
            validateDates(request.startDate(), request.endDate(), "diploma");
            diplomas.add(Diploma.builder()
                    .candidate(candidate)
                    .title(request.title().trim())
                    .startDate(request.startDate())
                    .endDate(request.endDate())
                    .institution(request.institution().trim())
                    .institutionCountry(normalizeCountry(request.institutionCountry()))
                    .degree(findDegree(request.degreeId()))
                    .studyField(findStudyField(request.studyFieldId()))
                    .sortOrder(i)
                    .build());
        }
        diplomaRepository.deleteAllByCandidateId(userId);
        diplomaRepository.saveAll(diplomas);
        touchUpdatedAt(candidate);
        log.info("Candidate profile diplomas updated : userId={}, count={}", userId, diplomas.size());
    }

    @Transactional
    public void updateSkills(UUID userId, List<SkillRequest> requests) {
        log.info("Candidate profile skills update requested : userId={}, count={}", userId, requests.size());
        Candidate candidate = findOrCreate(userId);
        List<CandidateSkill> skills = new ArrayList<>(requests.size());
        Set<UUID> seen = new HashSet<>();
        for (SkillRequest request : requests) {
            if (!seen.add(request.skillId())) {
                log.warn("Candidate profile skills update rejected : duplicate skill, userId={}, skillId={}",
                        userId, request.skillId());
                throw new InvalidProfileSectionException("Duplicate skill in payload : " + request.skillId());
            }
            skills.add(CandidateSkill.builder()
                    .candidate(candidate)
                    .skill(findSkill(request.skillId()))
                    .level(request.level())
                    .yearsExperience(request.yearsExperience())
                    .build());
        }
        candidateSkillRepository.deleteAllByCandidateId(userId);
        candidateSkillRepository.saveAll(skills);
        touchUpdatedAt(candidate);
        log.info("Candidate profile skills updated : userId={}, count={}", userId, skills.size());
    }

    @Transactional
    public void updateLanguages(UUID userId, List<LanguageRequest> requests) {
        log.info("Candidate profile languages update requested : userId={}, count={}", userId, requests.size());
        Candidate candidate = findOrCreate(userId);
        List<CandidateLanguage> languages = new ArrayList<>(requests.size());
        Set<UUID> seen = new HashSet<>();
        for (LanguageRequest request : requests) {
            if (!seen.add(request.languageId())) {
                log.warn("Candidate profile languages update rejected : duplicate language, userId={}, languageId={}",
                        userId, request.languageId());
                throw new InvalidProfileSectionException("Duplicate language in payload : " + request.languageId());
            }
            languages.add(CandidateLanguage.builder()
                    .candidate(candidate)
                    .language(findLanguage(request.languageId()))
                    .level(request.level())
                    .build());
        }
        candidateLanguageRepository.deleteAllByCandidateId(userId);
        candidateLanguageRepository.saveAll(languages);
        touchUpdatedAt(candidate);
        log.info("Candidate profile languages updated : userId={}, count={}", userId, languages.size());
    }

    @Transactional
    public void updateLinks(UUID userId, List<LinkRequest> requests) {
        log.info("Candidate profile links update requested : userId={}, count={}", userId, requests.size());
        Candidate candidate = findOrCreate(userId);
        List<CandidateLink> links = new ArrayList<>(requests.size());
        for (int i = 0; i < requests.size(); i++) {
            LinkRequest request = requests.get(i);
            LinkType linkType = parseLinkType(request.linkType(), userId);
            if (linkType != LinkType.CERTIFICATION && (request.issuer() != null || request.issuedAt() != null)) {
                log.warn("Candidate profile links update rejected : certification fields on a non certification link,"
                        + " userId={}, linkType={}", userId, linkType.getApiValue());
                throw new InvalidProfileSectionException(
                        "issuer and issuedAt are only allowed for a certification link");
            }
            links.add(CandidateLink.builder()
                    .candidate(candidate)
                    .label(request.label().trim())
                    .url(request.url().trim())
                    .linkType(linkType)
                    .issuer(request.issuer() == null ? null : request.issuer().trim())
                    .issuedAt(request.issuedAt())
                    .sortOrder(i)
                    .build());
        }
        candidateLinkRepository.deleteAllByCandidateId(userId);
        candidateLinkRepository.saveAll(links);
        touchUpdatedAt(candidate);
        log.info("Candidate profile links updated : userId={}, count={}", userId, links.size());
    }

    @Transactional
    public void suggestSkills(UUID userId, SkillSuggestionRequest request) {
        log.info("Skill suggestions requested : userId={}, count={}", userId, request.names().size());
        Set<String> catalog = skillRepository.findAll().stream()
                .map(skill -> skill.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        Set<String> seen = skillSuggestionRepository.findByCandidateId(userId).stream()
                .map(suggestion -> suggestion.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toCollection(HashSet::new));
        List<String> stored = new ArrayList<>(request.names().size());
        for (String raw : request.names()) {
            String name = raw == null ? "" : raw.trim();
            if (name.isEmpty()) {
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            if (catalog.contains(key)) {
                log.warn("Skill suggestion ignored, already in catalogue : userId={}, name={}", userId, name);
                continue;
            }
            if (seen.add(key)) {
                stored.add(name);
            }
        }
        if (!stored.isEmpty()) {
            UUID candidateId = findOrCreate(userId).getId();
            skillSuggestionRepository.saveAll(stored.stream()
                    .map(name -> SkillSuggestion.builder()
                            .candidateId(candidateId)
                            .name(name)
                            .build())
                    .toList());
        }
        log.info("Skill suggestions stored : userId={}, stored={}, requested={}",
                userId, stored.size(), request.names().size());
    }

    @Transactional(readOnly = true)
    public List<SkillOption> getSkillOptions() {
        return skillRepository.findAllByOrderBySkillTypeAscNameAsc().stream()
                .map(candidateMapper::toSkillOption)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LanguageOption> getLanguageOptions() {
        return languageRepository.findAllByOrderByNameAsc().stream()
                .map(candidateMapper::toLanguageOption)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DegreeOption> getDegreeOptions() {
        return degreeRepository.findAllByOrderByLabelAsc().stream()
                .map(candidateMapper::toDegreeOption)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudyFieldOption> getStudyFieldOptions() {
        return studyFieldRepository.findAllByOrderByLabelAsc().stream()
                .map(candidateMapper::toStudyFieldOption)
                .toList();
    }

    private Candidate findOrCreate(UUID userId) {
        return candidateRepository.findById(userId).orElseGet(() -> {
            Candidate candidate = Candidate.builder().id(userId).build();
            Candidate saved = candidateRepository.save(candidate);
            log.info("Candidate row created : userId={}", userId);
            return saved;
        });
    }

    /**
     * Heartbeat : les sections filles (expériences, diplômes, compétences,
     * langues, liens) ne modifient jamais la ligne candidates — son
     * updated_at ne bougerait pas, or c'est le signal du dirty-flag
     * (updated_at &gt; max(normalized_profile.validated_at)).
     */
    private void touchUpdatedAt(Candidate candidate) {
        candidate.setUpdatedAt(LocalDateTime.now());
        candidateRepository.save(candidate);
    }

    private CandidateProfileResponse emptyProfile() {
        return new CandidateProfileResponse(
                new AboutResponse(null, null, null, null, null),
                List.of(), List.of(), List.of(), List.of(), List.of(),
                0, false, false, false);
    }

    private int computeCompletion(AboutResponse about, List<ExperienceResponse> experiences,
            List<DiplomaResponse> diplomas, List<SkillResponse> skills, List<LanguageResponse> languages,
            List<LinkResponse> links) {
        int filled = 0;
        if (isFilled(about.title()) && isFilled(about.bio())) {
            filled++;
        }
        if (!experiences.isEmpty()) {
            filled++;
        }
        if (!diplomas.isEmpty()) {
            filled++;
        }
        if (!skills.isEmpty()) {
            filled++;
        }
        if (!languages.isEmpty()) {
            filled++;
        }
        if (!links.isEmpty()) {
            filled++;
        }
        return filled * 100 / COMPLETION_SECTIONS;
    }

    private void validateDates(LocalDate startDate, LocalDate endDate, String section) {
        if (endDate != null && endDate.isBefore(startDate)) {
            log.warn("Candidate profile {} update rejected : end date before start date, start={}, end={}",
                    section, startDate, endDate);
            throw new InvalidProfileSectionException("End date must be on or after the start date");
        }
    }

    private SearchStatus parseSearchStatus(String value) {
        try {
            return SearchStatus.fromApiValue(value);
        } catch (IllegalArgumentException ex) {
            log.warn("Candidate profile about update rejected : unknown search status, value={}", value);
            throw new InvalidProfileSectionException("Unknown search status : " + value);
        }
    }

    private LinkType parseLinkType(String value, UUID userId) {
        try {
            return LinkType.fromApiValue(value);
        } catch (IllegalArgumentException ex) {
            log.warn("Candidate profile links update rejected : unknown link type, userId={}, value={}", userId, value);
            throw new InvalidProfileSectionException("Unknown link type : " + value);
        }
    }

    private Skill findSkill(UUID id) {
        return skillRepository.findById(id)
                .orElseThrow(() -> {
                    log.warn("Candidate profile skills update rejected : unknown skill, skillId={}", id);
                    return new ReferenceNotFoundException("Skill", id);
                });
    }

    private Language findLanguage(UUID id) {
        return languageRepository.findById(id)
                .orElseThrow(() -> {
                    log.warn("Candidate profile languages update rejected : unknown language, languageId={}", id);
                    return new ReferenceNotFoundException("Language", id);
                });
    }

    private Degree findDegree(UUID id) {
        if (id == null) {
            return null;
        }
        return degreeRepository.findById(id)
                .orElseThrow(() -> {
                    log.warn("Candidate profile diplomas update rejected : unknown degree, degreeId={}", id);
                    return new ReferenceNotFoundException("Degree", id);
                });
    }

    private StudyField findStudyField(UUID id) {
        if (id == null) {
            return null;
        }
        return studyFieldRepository.findById(id)
                .orElseThrow(() -> {
                    log.warn("Candidate profile diplomas update rejected : unknown study field, studyFieldId={}", id);
                    return new ReferenceNotFoundException("Study field", id);
                });
    }

    private static boolean isFilled(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeCountry(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toUpperCase();
    }
}
