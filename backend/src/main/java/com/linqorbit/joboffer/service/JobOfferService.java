package com.linqorbit.joboffer.service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.repository.CompanyMemberRepository;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferLanguageOption;
import com.linqorbit.joboffer.dto.JobOfferLanguageRequest;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.JobOfferSkillOption;
import com.linqorbit.joboffer.dto.JobOfferSkillRequest;
import com.linqorbit.joboffer.dto.PublicJobResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.entity.ContractType;
import com.linqorbit.joboffer.entity.EmploymentType;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferDegree;
import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.JobOfferStudyField;
import com.linqorbit.joboffer.entity.RequirementType;
import com.linqorbit.joboffer.entity.SalaryPeriod;
import com.linqorbit.joboffer.entity.Seniority;
import com.linqorbit.joboffer.entity.WorkMode;
import com.linqorbit.joboffer.exception.InvalidJobOfferException;
import com.linqorbit.joboffer.exception.InvalidJobOfferStatusException;
import com.linqorbit.joboffer.exception.JobOfferAccessDeniedException;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.exception.JobOfferReferenceNotFoundException;
import com.linqorbit.joboffer.repository.ContractTypeRepository;
import com.linqorbit.joboffer.repository.EmploymentTypeRepository;
import com.linqorbit.joboffer.repository.JobOfferDegreeRepository;
import com.linqorbit.joboffer.repository.JobOfferLanguageRepository;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.JobOfferSkillRepository;
import com.linqorbit.joboffer.repository.JobOfferStudyFieldRepository;
import com.linqorbit.joboffer.repository.WorkModeRepository;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.repository.RecruiterRepository;

/**
 * Offres d'emploi (D12–D14) : création en DRAFT par un membre de la company,
 * édition réservée à l'owner de la company ou au recruteur créateur
 * (permissions coarse D12), transitions D13 (validate ≠ publish). Les
 * vocabulaires sont vérifiés (D14) — aucune référence inventée.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JobOfferService {

    private static final String BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

    private final JobOfferRepository jobOfferRepository;
    private final JobOfferSkillRepository jobOfferSkillRepository;
    private final JobOfferLanguageRepository jobOfferLanguageRepository;
    private final JobOfferDegreeRepository jobOfferDegreeRepository;
    private final JobOfferStudyFieldRepository jobOfferStudyFieldRepository;
    private final CompanyMemberRepository companyMemberRepository;
    private final CompanyRepository companyRepository;
    private final RecruiterRepository recruiterRepository;
    private final SkillRepository skillRepository;
    private final LanguageRepository languageRepository;
    private final DegreeRepository degreeRepository;
    private final StudyFieldRepository studyFieldRepository;
    private final ContractTypeRepository contractTypeRepository;
    private final EmploymentTypeRepository employmentTypeRepository;
    private final WorkModeRepository workModeRepository;

    @Transactional
    public JobOfferResponse create(UUID userId, CreateJobOfferRequest request) {
        requireRecruiter(userId);
        requireMembership(request.companyId(), userId);
        validateSalaryRange(request.salaryMin(), request.salaryMax());
        validateVocabularies(request.skills(), request.languages(), request.degreeIds(), request.studyFieldIds(),
                request.contractTypeId(), request.employmentTypeId(), request.workModeId());

        LocalDateTime now = LocalDateTime.now();
        JobOffer offer = JobOffer.builder()
                .companyId(request.companyId())
                .recruiterId(userId)
                .status(JobOfferStatus.DRAFT)
                .title(request.title().trim())
                .publicId(generatePublicId())
                .slug(slugify(request.title()))
                .description(trimToNull(request.description()))
                .seniority(parseSeniority(request.seniority()))
                .requiredExpYear(request.requiredExpYear())
                .city(trimToNull(request.city()))
                .country(trimToNull(request.country()))
                .contractTypeId(request.contractTypeId())
                .employmentTypeId(request.employmentTypeId())
                .workModeId(request.workModeId())
                .expiresAt(request.expiresAt())
                .salaryMin(request.salaryMin())
                .salaryMax(request.salaryMax())
                .salaryCurrency(trimToNull(request.salaryCurrency()))
                .salaryPeriod(parseSalaryPeriod(request.salaryPeriod()))
                .updatedAt(now)
                .build();
        jobOfferRepository.save(offer);

        replaceChildren(offer.getId(), request.skills(), request.languages(), request.degreeIds(), request.studyFieldIds());
        log.info("Job offer created : offerId={}, companyId={}, recruiterId={}",
                offer.getId(), offer.getCompanyId(), userId);
        return buildResponse(offer);
    }

    public List<JobOfferResponse> listMine(UUID userId) {
        requireRecruiter(userId);
        List<UUID> companyIds = companyIdsOf(userId);
        if (companyIds.isEmpty()) {
            return List.of();
        }
        List<JobOfferResponse> responses = buildResponses(
                jobOfferRepository.findByCompanyIdInOrderByCreatedAtDesc(companyIds));
        log.info("Job offers listed : recruiterId={}, count={}", userId, responses.size());
        return responses;
    }

    public JobOfferResponse get(UUID userId, UUID offerId) {
        requireRecruiter(userId);
        return buildResponse(loadForMember(offerId, userId));
    }

    /**
     * Lecture publique (V15) : une seule fuite possible = existence. Le même
     * 404 (détail fixe du handler) couvre inconnu, non publié, clôturé et
     * expiré — aucune distinction côté client.
     */
    public PublicJobResponse getPublic(String publicId) {
        JobOffer offer = jobOfferRepository.findByPublicId(publicId)
                .orElseThrow(() -> {
                    log.warn("Public job offer rejected : unknown publicId={}", publicId);
                    return new JobOfferNotFoundException("Job offer not found.");
                });
        if (offer.getStatus() != JobOfferStatus.PUBLISHED
                || (offer.getExpiresAt() != null && offer.getExpiresAt().isBefore(LocalDate.now()))) {
            log.warn("Public job offer rejected : publicId={}, status={}, expiresAt={}",
                    publicId, offer.getStatus().getApiValue(), offer.getExpiresAt());
            throw new JobOfferNotFoundException("Job offer not found.");
        }
        return buildPublicResponse(offer);
    }

    @Transactional
    public void update(UUID userId, UUID offerId, UpdateJobOfferRequest request) {
        JobOffer offer = loadForManagement(offerId, userId);
        requireEditable(offer);
        validateSalaryRange(request.salaryMin(), request.salaryMax());
        validateVocabularies(request.skills(), request.languages(), request.degreeIds(), request.studyFieldIds(),
                request.contractTypeId(), request.employmentTypeId(), request.workModeId());

        offer.setTitle(request.title().trim());
        // Slug cosmétique dérivé du titre — régénéré à chaque édition
        // (idempotent : un titre inchangé produit le même slug).
        offer.setSlug(slugify(request.title()));
        offer.setDescription(trimToNull(request.description()));
        offer.setSeniority(parseSeniority(request.seniority()));
        offer.setRequiredExpYear(request.requiredExpYear());
        offer.setCity(trimToNull(request.city()));
        offer.setCountry(trimToNull(request.country()));
        offer.setContractTypeId(request.contractTypeId());
        offer.setEmploymentTypeId(request.employmentTypeId());
        offer.setWorkModeId(request.workModeId());
        offer.setExpiresAt(request.expiresAt());
        offer.setSalaryMin(request.salaryMin());
        offer.setSalaryMax(request.salaryMax());
        offer.setSalaryCurrency(trimToNull(request.salaryCurrency()));
        offer.setSalaryPeriod(parseSalaryPeriod(request.salaryPeriod()));
        offer.setUpdatedAt(LocalDateTime.now());

        replaceChildren(offerId, request.skills(), request.languages(), request.degreeIds(), request.studyFieldIds());
        jobOfferRepository.save(offer);
        log.info("Job offer updated : offerId={}, status={}", offerId, offer.getStatus().getApiValue());
    }

    @Transactional
    public void delete(UUID userId, UUID offerId) {
        JobOffer offer = loadForManagement(offerId, userId);
        if (offer.getStatus() != JobOfferStatus.DRAFT) {
            log.warn("Job offer deletion rejected : offerId={}, status={}", offerId, offer.getStatus().getApiValue());
            throw new InvalidJobOfferStatusException(offer.getStatus(), "delete");
        }
        jobOfferSkillRepository.deleteByJobOfferId(offerId);
        jobOfferLanguageRepository.deleteByJobOfferId(offerId);
        jobOfferDegreeRepository.deleteByJobOfferId(offerId);
        jobOfferStudyFieldRepository.deleteByJobOfferId(offerId);
        jobOfferRepository.delete(offer);
        log.info("Job offer deleted : offerId={}", offerId);
    }

    @Transactional
    public void validate(UUID userId, UUID offerId) {
        transition(userId, offerId, "validate",
                status -> status == JobOfferStatus.DRAFT || status == JobOfferStatus.VALIDATED,
                offer -> {
                    offer.setStatus(JobOfferStatus.VALIDATED);
                    LocalDateTime now = LocalDateTime.now();
                    offer.setValidatedAt(now);
                    offer.setUpdatedAt(now);
                });
    }

    @Transactional
    public void publish(UUID userId, UUID offerId) {
        transition(userId, offerId, "publish",
                status -> status == JobOfferStatus.VALIDATED,
                offer -> {
                    offer.setStatus(JobOfferStatus.PUBLISHED);
                    LocalDateTime now = LocalDateTime.now();
                    offer.setPublishedAt(now);
                    offer.setUpdatedAt(now);
                });
    }

    @Transactional
    public void close(UUID userId, UUID offerId) {
        transition(userId, offerId, "close",
                status -> status == JobOfferStatus.VALIDATED || status == JobOfferStatus.PUBLISHED,
                offer -> {
                    offer.setStatus(JobOfferStatus.CLOSED);
                    offer.setUpdatedAt(LocalDateTime.now());
                });
    }

    private void transition(UUID userId, UUID offerId, String action,
            Predicate<JobOfferStatus> allowed, Consumer<JobOffer> apply) {
        JobOffer offer = loadForManagement(offerId, userId);
        if (!allowed.test(offer.getStatus())) {
            log.warn("Job offer transition rejected : offerId={}, action={}, status={}",
                    offerId, action, offer.getStatus().getApiValue());
            throw new InvalidJobOfferStatusException(offer.getStatus(), action);
        }
        apply.accept(offer);
        jobOfferRepository.save(offer);
        log.info("Job offer transition : offerId={}, action={}, status={}",
                offerId, action, offer.getStatus().getApiValue());
    }

    private JobOffer loadForMember(UUID offerId, UUID userId) {
        List<UUID> companyIds = companyIdsOf(userId);
        if (companyIds.isEmpty()) {
            log.warn("Job offer read rejected : no company membership, offerId={}, recruiterId={}", offerId, userId);
            throw new JobOfferNotFoundException(offerId);
        }
        return jobOfferRepository.findByIdAndCompanyIdIn(offerId, companyIds)
                .orElseThrow(() -> {
                    log.warn("Job offer read rejected : offerId={}, recruiterId={}", offerId, userId);
                    return new JobOfferNotFoundException(offerId);
                });
    }

    private JobOffer loadForManagement(UUID offerId, UUID userId) {
        requireRecruiter(userId);
        JobOffer offer = loadForMember(offerId, userId);
        CompanyMember membership = companyMemberRepository
                .findByCompanyIdAndRecruiterId(offer.getCompanyId(), userId)
                .orElseThrow(() -> new JobOfferNotFoundException(offerId));
        boolean isOwner = Boolean.TRUE.equals(membership.getIsOwner());
        if (!isOwner && !offer.getRecruiterId().equals(userId)) {
            log.warn("Job offer management rejected : offerId={}, recruiterId={}", offerId, userId);
            throw new JobOfferAccessDeniedException(offerId, userId);
        }
        return offer;
    }

    private void requireEditable(JobOffer offer) {
        if (offer.getStatus() != JobOfferStatus.DRAFT && offer.getStatus() != JobOfferStatus.VALIDATED) {
            log.warn("Job offer edit rejected : offerId={}, status={}", offer.getId(), offer.getStatus().getApiValue());
            throw new InvalidJobOfferStatusException(offer.getStatus(), "edit");
        }
    }

    private void requireRecruiter(UUID userId) {
        if (!recruiterRepository.existsById(userId)) {
            log.warn("Job offer operation rejected : no recruiter profile, userId={}", userId);
            throw new RecruiterNotFoundException();
        }
    }

    private void requireMembership(UUID companyId, UUID userId) {
        if (companyMemberRepository.findByCompanyIdAndRecruiterId(companyId, userId).isEmpty()) {
            log.warn("Job offer creation rejected : not a member, companyId={}, recruiterId={}", companyId, userId);
            throw new JobOfferNotFoundException("You are not a member of this company.");
        }
    }

    private List<UUID> companyIdsOf(UUID userId) {
        return companyMemberRepository.findByRecruiterId(userId).stream()
                .map(CompanyMember::getCompanyId)
                .toList();
    }

    private void replaceChildren(UUID offerId, List<JobOfferSkillRequest> skills,
            List<JobOfferLanguageRequest> languages, List<UUID> degreeIds, List<UUID> studyFieldIds) {
        jobOfferSkillRepository.deleteByJobOfferId(offerId);
        jobOfferLanguageRepository.deleteByJobOfferId(offerId);
        jobOfferDegreeRepository.deleteByJobOfferId(offerId);
        jobOfferStudyFieldRepository.deleteByJobOfferId(offerId);

        // Dédup par id (première occurrence gagne), miroir de unique() : la PK
        // composite rejeterait un doublon en 500 au lieu d'un 400 de validation.
        if (!skills.isEmpty()) {
            Map<UUID, JobOfferSkillRequest> distinctSkills = new LinkedHashMap<>();
            skills.forEach(skill -> distinctSkills.putIfAbsent(skill.skillId(), skill));
            jobOfferSkillRepository.saveAll(distinctSkills.values().stream()
                    .map(skill -> JobOfferSkill.builder()
                            .jobOfferId(offerId)
                            .skillId(skill.skillId())
                            .requirementType(RequirementType.fromApiValue(skill.requirementType()))
                            .weight(skill.weight())
                            .yearsExperience(skill.yearsExperience())
                            .build())
                    .toList());
        }
        if (!languages.isEmpty()) {
            Map<UUID, JobOfferLanguageRequest> distinctLanguages = new LinkedHashMap<>();
            languages.forEach(language -> distinctLanguages.putIfAbsent(language.languageId(), language));
            jobOfferLanguageRepository.saveAll(distinctLanguages.values().stream()
                    .map(language -> JobOfferLanguage.builder()
                            .jobOfferId(offerId)
                            .languageId(language.languageId())
                            .level(language.level())
                            .isRequired(language.isRequired())
                            .build())
                    .toList());
        }
        if (!degreeIds.isEmpty()) {
            jobOfferDegreeRepository.saveAll(unique(degreeIds).stream()
                    .map(degreeId -> JobOfferDegree.builder()
                            .jobOfferId(offerId)
                            .degreeId(degreeId)
                            .build())
                    .toList());
        }
        if (!studyFieldIds.isEmpty()) {
            jobOfferStudyFieldRepository.saveAll(unique(studyFieldIds).stream()
                    .map(studyFieldId -> JobOfferStudyField.builder()
                            .jobOfferId(offerId)
                            .studyFieldId(studyFieldId)
                            .build())
                    .toList());
        }
    }

    /**
     * D14 : toute référence doit exister — aucune invention. Les enums (statut
     * d'exigence, séniorité, période) sont parsées par les helpers dédiés.
     */
    private void validateVocabularies(List<JobOfferSkillRequest> skills, List<JobOfferLanguageRequest> languages,
            List<UUID> degreeIds, List<UUID> studyFieldIds, UUID contractTypeId, UUID employmentTypeId,
            UUID workModeId) {
        for (JobOfferSkillRequest skill : skills) {
            try {
                RequirementType.fromApiValue(skill.requirementType());
            } catch (IllegalArgumentException ex) {
                throw new JobOfferReferenceNotFoundException("requirement type", skill.requirementType());
            }
        }
        requireAllSkillsExist(skills);
        requireAllLanguagesExist(languages);
        requireAllExist(degreeIds, degreeRepository::existsById, "degree");
        requireAllExist(studyFieldIds, studyFieldRepository::existsById, "study field");
        requireExists(contractTypeId, contractTypeRepository::existsById, "contract type");
        requireExists(employmentTypeId, employmentTypeRepository::existsById, "employment type");
        requireExists(workModeId, workModeRepository::existsById, "work mode");
    }

    private void requireAllSkillsExist(List<JobOfferSkillRequest> skills) {
        Set<UUID> requested = skills.stream()
                .map(JobOfferSkillRequest::skillId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        requireAllExist(requested, skillRepository::existsById, "skill");
    }

    private void requireAllLanguagesExist(List<JobOfferLanguageRequest> languages) {
        Set<UUID> requested = languages.stream()
                .map(JobOfferLanguageRequest::languageId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        requireAllExist(requested, languageRepository::existsById, "language");
    }

    private static void requireAllExist(Collection<UUID> ids, Predicate<UUID> exists, String resource) {
        for (UUID id : ids) {
            requireExists(id, exists, resource);
        }
    }

    private static void requireExists(UUID id, Predicate<UUID> exists, String resource) {
        if (id != null && !exists.test(id)) {
            throw new JobOfferReferenceNotFoundException(resource, id);
        }
    }

    private JobOfferResponse buildResponse(JobOffer offer) {
        return buildResponses(List.of(offer)).get(0);
    }

    private List<JobOfferResponse> buildResponses(List<JobOffer> offers) {
        if (offers.isEmpty()) {
            return List.of();
        }
        List<UUID> offerIds = offers.stream().map(JobOffer::getId).toList();
        List<JobOfferSkill> skills = jobOfferSkillRepository.findByJobOfferIdIn(offerIds);
        List<JobOfferLanguage> languages = jobOfferLanguageRepository.findByJobOfferIdIn(offerIds);
        List<JobOfferDegree> degrees = jobOfferDegreeRepository.findByJobOfferIdIn(offerIds);
        List<JobOfferStudyField> studyFields = jobOfferStudyFieldRepository.findByJobOfferIdIn(offerIds);

        Map<UUID, Skill> skillMap = loadSkills(skills);
        Map<UUID, Language> languageMap = loadLanguages(languages);

        Map<UUID, List<JobOfferSkill>> skillsByOffer = groupBy(skills, JobOfferSkill::getJobOfferId);
        Map<UUID, List<JobOfferLanguage>> languagesByOffer = groupBy(languages, JobOfferLanguage::getJobOfferId);
        Map<UUID, List<JobOfferDegree>> degreesByOffer = groupBy(degrees, JobOfferDegree::getJobOfferId);
        Map<UUID, List<JobOfferStudyField>> studyFieldsByOffer = groupBy(studyFields, JobOfferStudyField::getJobOfferId);

        return offers.stream()
                .map(offer -> new JobOfferResponse(
                        offer.getId(),
                        offer.getCompanyId(),
                        offer.getRecruiterId(),
                        offer.getStatus().getApiValue(),
                        offer.getTitle(),
                        offer.getPublicId(),
                        offer.getSlug(),
                        offer.getDescription(),
                        offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                        offer.getRequiredExpYear(),
                        offer.getCity(),
                        offer.getCountry(),
                        offer.getContractTypeId(),
                        offer.getEmploymentTypeId(),
                        offer.getWorkModeId(),
                        offer.getValidatedAt(),
                        offer.getPublishedAt(),
                        offer.getExpiresAt(),
                        offer.getSalaryMin(),
                        offer.getSalaryMax(),
                        offer.getSalaryCurrency(),
                        offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                        // D13 : le dirty-flag n'a de sens que sur un statut éditable —
                        // publish/close posent updatedAt après validatedAt et fausseraient
                        // le signal sur PUBLISHED/CLOSED (lecture seule).
                        (offer.getStatus() == JobOfferStatus.DRAFT
                                || offer.getStatus() == JobOfferStatus.VALIDATED)
                                && offer.getValidatedAt() != null
                                && offer.getUpdatedAt() != null
                                && offer.getUpdatedAt().isAfter(offer.getValidatedAt()),
                        skillsByOffer.getOrDefault(offer.getId(), List.of()).stream()
                                .map(skill -> new JobOfferSkillOption(
                                        skill.getSkillId(),
                                        skillName(skillMap, skill.getSkillId()),
                                        skill.getRequirementType().getApiValue(),
                                        skill.getWeight(),
                                        skill.getYearsExperience()))
                                .toList(),
                        languagesByOffer.getOrDefault(offer.getId(), List.of()).stream()
                                .map(language -> new JobOfferLanguageOption(
                                        language.getLanguageId(),
                                        languageSymbol(languageMap, language.getLanguageId()),
                                        languageName(languageMap, language.getLanguageId()),
                                        language.getLevel(),
                                        Boolean.TRUE.equals(language.getIsRequired())))
                                .toList(),
                        degreesByOffer.getOrDefault(offer.getId(), List.of()).stream()
                                .map(JobOfferDegree::getDegreeId)
                                .toList(),
                        studyFieldsByOffer.getOrDefault(offer.getId(), List.of()).stream()
                                .map(JobOfferStudyField::getStudyFieldId)
                                .toList(),
                        offer.getCreatedAt(),
                        offer.getUpdatedAt()))
                .toList();
    }

    /**
     * Fiche publique : labels résolus (company, vocabulaires, mentions) — le
     * HTML de la description est déjà sanitisé en base (D19).
     */
    private PublicJobResponse buildPublicResponse(JobOffer offer) {
        String companyName = companyRepository.findById(offer.getCompanyId())
                .map(Company::getName)
                .orElse(null);

        List<JobOfferSkill> skills = jobOfferSkillRepository.findByJobOfferIdIn(List.of(offer.getId()));
        List<JobOfferLanguage> languages = jobOfferLanguageRepository.findByJobOfferIdIn(List.of(offer.getId()));
        List<JobOfferDegree> degrees = jobOfferDegreeRepository.findByJobOfferIdIn(List.of(offer.getId()));
        List<JobOfferStudyField> studyFields = jobOfferStudyFieldRepository.findByJobOfferIdIn(List.of(offer.getId()));
        Map<UUID, Skill> skillMap = loadSkills(skills);
        Map<UUID, Language> languageMap = loadLanguages(languages);

        return new PublicJobResponse(
                offer.getPublicId(),
                offer.getSlug(),
                offer.getTitle(),
                offer.getDescription(),
                offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                offer.getRequiredExpYear(),
                offer.getCity(),
                offer.getCountry(),
                companyName,
                labelOf(offer.getContractTypeId(),
                        id -> contractTypeRepository.findById(id).map(ContractType::getLabel).orElse(null)),
                labelOf(offer.getEmploymentTypeId(),
                        id -> employmentTypeRepository.findById(id).map(EmploymentType::getLabel).orElse(null)),
                labelOf(offer.getWorkModeId(),
                        id -> workModeRepository.findById(id).map(WorkMode::getLabel).orElse(null)),
                offer.getSalaryMin(),
                offer.getSalaryMax(),
                offer.getSalaryCurrency(),
                offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                offer.getExpiresAt(),
                skills.stream()
                        .map(skill -> new JobOfferSkillOption(
                                skill.getSkillId(),
                                skillName(skillMap, skill.getSkillId()),
                                skill.getRequirementType().getApiValue(),
                                skill.getWeight(),
                                skill.getYearsExperience()))
                        .toList(),
                languages.stream()
                        .map(language -> new JobOfferLanguageOption(
                                language.getLanguageId(),
                                languageSymbol(languageMap, language.getLanguageId()),
                                languageName(languageMap, language.getLanguageId()),
                                language.getLevel(),
                                Boolean.TRUE.equals(language.getIsRequired())))
                        .toList(),
                loadDegreeLabels(degrees),
                loadStudyFieldLabels(studyFields),
                offer.getPublishedAt());
    }

    private List<String> loadDegreeLabels(List<JobOfferDegree> degrees) {
        if (degrees.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> labels = degreeRepository.findAllById(
                        degrees.stream().map(JobOfferDegree::getDegreeId).toList()).stream()
                .collect(Collectors.toMap(Degree::getId, Degree::getLabel));
        return degrees.stream()
                .map(degree -> labels.get(degree.getDegreeId()))
                .filter(Objects::nonNull)
                .toList();
    }

    private List<String> loadStudyFieldLabels(List<JobOfferStudyField> studyFields) {
        if (studyFields.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> labels = studyFieldRepository.findAllById(
                        studyFields.stream().map(JobOfferStudyField::getStudyFieldId).toList()).stream()
                .collect(Collectors.toMap(StudyField::getId, StudyField::getLabel));
        return studyFields.stream()
                .map(studyField -> labels.get(studyField.getStudyFieldId()))
                .filter(Objects::nonNull)
                .toList();
    }

    /** FK vocabulaire nullable : {@code findById(null)} lèverait côté JPA. */
    private static String labelOf(UUID id, Function<UUID, String> label) {
        return id == null ? null : label.apply(id);
    }

    /**
     * Identifiant public : 12 caractères base36 (SecureRandom) — sans tiret,
     * pour que le split d'URL /jobs/{publicId}-{slug} isole le publicId sur
     * le premier tiret.
     */
    private static String generatePublicId() {
        StringBuilder id = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            id.append(BASE36.charAt(ThreadLocalRandom.current().nextInt(BASE36.length())));
        }
        return id.toString();
    }

    /** Slug cosmétique : minuscules ASCII sans diacritiques, tirets. */
    static String slugify(String title) {
        if (title == null) {
            return "";
        }
        String slug = Normalizer.normalize(title.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (slug.length() > 120) {
            slug = slug.substring(0, 120).replaceAll("-+$", "");
        }
        return slug;
    }

    private Map<UUID, Skill> loadSkills(List<JobOfferSkill> skills) {
        Set<UUID> ids = skills.stream()
                .map(JobOfferSkill::getSkillId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        return skillRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Skill::getId, Function.identity()));
    }

    private Map<UUID, Language> loadLanguages(List<JobOfferLanguage> languages) {
        Set<UUID> ids = languages.stream()
                .map(JobOfferLanguage::getLanguageId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        return languageRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Language::getId, Function.identity()));
    }

    private void validateSalaryRange(BigDecimal min, BigDecimal max) {
        if (min != null && max != null && min.compareTo(max) > 0) {
            throw new InvalidJobOfferException("Salary minimum cannot be greater than salary maximum.");
        }
    }

    private Seniority parseSeniority(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Seniority.fromApiValue(value);
        } catch (IllegalArgumentException ex) {
            throw new InvalidJobOfferException("Unknown seniority: " + value);
        }
    }

    private SalaryPeriod parseSalaryPeriod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return SalaryPeriod.fromApiValue(value);
        } catch (IllegalArgumentException ex) {
            throw new InvalidJobOfferException("Unknown salary period: " + value);
        }
    }

    private static String skillName(Map<UUID, Skill> skills, UUID id) {
        Skill skill = skills.get(id);
        return skill == null ? null : skill.getName();
    }

    private static String languageName(Map<UUID, Language> languages, UUID id) {
        Language language = languages.get(id);
        return language == null ? null : language.getName();
    }

    private static String languageSymbol(Map<UUID, Language> languages, UUID id) {
        Language language = languages.get(id);
        return language == null ? null : language.getSymbol();
    }

    private static Set<UUID> unique(Collection<UUID> ids) {
        return new LinkedHashSet<>(ids);
    }

    private static <T> Map<UUID, List<T>> groupBy(List<T> rows, Function<T, UUID> key) {
        Map<UUID, List<T>> map = new HashMap<>();
        for (T row : rows) {
            map.computeIfAbsent(key.apply(row), k -> new ArrayList<>()).add(row);
        }
        return map;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
