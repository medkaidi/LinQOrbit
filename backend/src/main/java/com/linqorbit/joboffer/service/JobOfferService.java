package com.linqorbit.joboffer.service;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.common.pagination.PageSizes;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
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
import com.linqorbit.joboffer.dto.JobOfferAdminView;
import com.linqorbit.joboffer.dto.JobOfferLanguageOption;
import com.linqorbit.joboffer.dto.JobOfferLanguageRequest;
import com.linqorbit.joboffer.dto.JobOfferListItem;
import com.linqorbit.joboffer.dto.JobOfferPageResponse;
import com.linqorbit.joboffer.dto.JobOfferQuestionOptionRequest;
import com.linqorbit.joboffer.dto.JobOfferQuestionOptionView;
import com.linqorbit.joboffer.dto.JobOfferQuestionRequest;
import com.linqorbit.joboffer.dto.JobOfferQuestionView;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.JobOfferSkillOption;
import com.linqorbit.joboffer.dto.JobOfferSkillRequest;
import com.linqorbit.joboffer.dto.PublicJobListItem;
import com.linqorbit.joboffer.dto.PublicJobPageResponse;
import com.linqorbit.joboffer.dto.PublicJobResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.entity.ContractType;
import com.linqorbit.joboffer.entity.EmploymentType;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferDegree;
import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferQuestion;
import com.linqorbit.joboffer.entity.JobOfferQuestionOption;
import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.JobOfferStudyField;
import com.linqorbit.joboffer.entity.QuestionType;
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
import com.linqorbit.joboffer.repository.JobOfferQuestionOptionRepository;
import com.linqorbit.joboffer.repository.JobOfferQuestionRepository;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.JobOfferSkillRepository;
import com.linqorbit.joboffer.repository.JobOfferStudyFieldRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
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

    /** Nombre maximal d'« autres offres » de la même entreprise (taille décidée backend). */
    private static final int RELATED_PUBLIC_JOBS_LIMIT = 3;

    private final JobOfferRepository jobOfferRepository;
    private final JobOfferSkillRepository jobOfferSkillRepository;
    private final JobOfferLanguageRepository jobOfferLanguageRepository;
    private final JobOfferDegreeRepository jobOfferDegreeRepository;
    private final JobOfferStudyFieldRepository jobOfferStudyFieldRepository;
    private final JobOfferQuestionRepository jobOfferQuestionRepository;
    private final JobOfferQuestionOptionRepository jobOfferQuestionOptionRepository;
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
    private final NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private final JobOfferNormalizationService jobOfferNormalizationService;

    @Transactional
    public JobOfferResponse create(UUID userId, CreateJobOfferRequest request) {
        requireRecruiter(userId);
        requireMembership(request.companyId(), userId);
        validateSalaryRange(request.salaryMin(), request.salaryMax());
        // Cohérence intrinsèque d'abord — pas de résolution de références pour un corps incohérent
        validateQuestions(request.questions());
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
                .maxClarificationQuestions(clarificationCap(request.maxClarificationQuestions()))
                .updatedAt(now)
                .build();
        jobOfferRepository.save(offer);

        replaceChildren(offer.getId(), request.skills(), request.languages(), request.degreeIds(),
                request.studyFieldIds(), request.questions());
        log.info("Job offer created : offerId={}, companyId={}, recruiterId={}",
                offer.getId(), offer.getCompanyId(), userId);
        return buildResponse(offer);
    }

    /**
     * Liste paginée des offres du recruteur (D34) : la taille de page est
     * décidée par le backend (défaut 20, clamp 50 — les paramètres sont
     * optionnels) et la valeur effective part dans l'enveloppe. Lecture
     * seule : une tx unique pour toutes les requêtes de buildListItems
     * (open-in-view est désactivé). Les lignes sont légères — la description
     * et les listes enfants ne sortent que par {@link #get}.
     */
    @Transactional(readOnly = true)
    public JobOfferPageResponse listMine(UUID userId, Integer page, Integer size) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(size);
        requireRecruiter(userId);
        List<UUID> companyIds = companyIdsOf(userId);
        if (companyIds.isEmpty()) {
            return new JobOfferPageResponse(List.of(), safePage, safeSize, 0);
        }
        Page<JobOffer> result = jobOfferRepository.findByCompanyIdIn(companyIds,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<JobOfferListItem> items = buildListItems(result.getContent());
        log.info("Job offers listed : recruiterId={}, page={}, size={}, count={}, total={}",
                userId, safePage, safeSize, items.size(), result.getTotalElements());
        return new JobOfferPageResponse(items, result.getNumber(), result.getSize(),
                result.getTotalElements());
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
        return buildPublicResponse(loadPublicOffer(publicId));
    }

    /**
     * « Autres offres » de la fiche publique (T-74) : endpoint séparé pour ne
     * pas alourdir le détail — les autres offres PUBLISHED non expirées de la
     * même entreprise, de la plus récente à la plus ancienne, bornées par le
     * backend. Mêmes règles d'accès que la fiche (404 sûr sur l'offre de
     * référence).
     */
    @Transactional(readOnly = true)
    public List<PublicJobListItem> listRelatedPublic(String publicId) {
        JobOffer offer = loadPublicOffer(publicId);
        Page<JobOffer> result = jobOfferRepository.findPublicRelated(
                JobOfferStatus.PUBLISHED, LocalDate.now(), offer.getCompanyId(), publicId,
                PageRequest.of(0, RELATED_PUBLIC_JOBS_LIMIT,
                        Sort.by(Sort.Direction.DESC, "publishedAt")));
        List<PublicJobListItem> items = buildPublicListItems(result.getContent());
        log.info("Related public jobs listed : publicId={}, companyId={}, count={}",
                publicId, offer.getCompanyId(), items.size());
        return items;
    }

    /** Offre publiée lisible publiquement — 404 sûr unique (inconnu, non publié, expiré). */
    private JobOffer loadPublicOffer(String publicId) {
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
        return offer;
    }

    /**
     * Job board public (T-72) : offres PUBLISHED non expirées, triées de la
     * plus récemment publiée à la plus ancienne. Même enveloppe D34 que les
     * autres listes — seule {@code page} est exposée, la taille reste
     * décidée par le backend. Labels résolus en batch (companies,
     * vocabulaires, compétences) : le visiteur n'a pas les référentiels,
     * jamais de N+1.
     */
    @Transactional(readOnly = true)
    public PublicJobPageResponse listPublic(Integer page) {
        int safePage = PageSizes.page(page);
        int safeSize = PageSizes.clamp(null);
        Page<JobOffer> result = jobOfferRepository.findPublic(JobOfferStatus.PUBLISHED, LocalDate.now(),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "publishedAt")));
        List<PublicJobListItem> items = buildPublicListItems(result.getContent());
        log.info("Public jobs listed : page={}, size={}, count={}, total={}",
                safePage, safeSize, items.size(), result.getTotalElements());
        return new PublicJobPageResponse(items, result.getNumber(), result.getSize(),
                result.getTotalElements());
    }

    /**
     * Lignes du job board : ni description ni listes enfants — company,
     * vocabulaires et compétences résolus en labels par requêtes batch (pas de
     * requête par ligne). Les compétences sont toutes exposées (transparence
     * candidat), triées poids décroissant puis nom.
     */
    private List<PublicJobListItem> buildPublicListItems(List<JobOffer> offers) {
        if (offers.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> companyNames = companyRepository.findAllById(
                        offers.stream().map(JobOffer::getCompanyId).toList()).stream()
                .collect(Collectors.toMap(Company::getId, Company::getName));
        Map<UUID, String> contractTypes = batchLabels(
                contractTypeRepository.findAllById(nonNullIds(offers.stream()
                        .map(JobOffer::getContractTypeId).toList())),
                ContractType::getId, ContractType::getLabel);
        Map<UUID, String> employmentTypes = batchLabels(
                employmentTypeRepository.findAllById(nonNullIds(offers.stream()
                        .map(JobOffer::getEmploymentTypeId).toList())),
                EmploymentType::getId, EmploymentType::getLabel);
        Map<UUID, String> workModes = batchLabels(
                workModeRepository.findAllById(nonNullIds(offers.stream()
                        .map(JobOffer::getWorkModeId).toList())),
                WorkMode::getId, WorkMode::getLabel);
        List<JobOfferSkill> skills = jobOfferSkillRepository.findByJobOfferIdIn(
                offers.stream().map(JobOffer::getId).toList());
        Map<UUID, Skill> skillVocabulary = loadSkills(skills);
        Map<UUID, List<JobOfferSkill>> skillsByOffer = groupBy(skills, JobOfferSkill::getJobOfferId);

        return offers.stream()
                .map(offer -> new PublicJobListItem(
                        offer.getPublicId(),
                        offer.getSlug(),
                        offer.getTitle(),
                        companyNames.get(offer.getCompanyId()),
                        offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                        offer.getCity(),
                        offer.getCountry(),
                        contractTypes.get(offer.getContractTypeId()),
                        employmentTypes.get(offer.getEmploymentTypeId()),
                        workModes.get(offer.getWorkModeId()),
                        orderedSkillLabels(skillsByOffer.get(offer.getId()), skillVocabulary),
                        offer.getSalaryMin(),
                        offer.getSalaryMax(),
                        offer.getSalaryCurrency(),
                        offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                        offer.getPublishedAt(),
                        offer.getExpiresAt()))
                .toList();
    }

    /**
     * Libellés de toutes les compétences d'une offre, poids décroissant puis
     * nom croissant (poids égal), les références vocabulaire absentes étant
     * ignorées.
     */
    private static List<String> orderedSkillLabels(List<JobOfferSkill> offerSkills, Map<UUID, Skill> skills) {
        if (offerSkills == null || offerSkills.isEmpty()) {
            return List.of();
        }
        return offerSkills.stream()
                .sorted(Comparator.comparing(JobOfferSkill::getWeight).reversed()
                        .thenComparing(skill -> skillName(skills, skill.getSkillId()),
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .map(skill -> skillName(skills, skill.getSkillId()))
                .filter(Objects::nonNull)
                .toList();
    }

    private static List<UUID> nonNullIds(Collection<UUID> ids) {
        return ids.stream().filter(Objects::nonNull).distinct().toList();
    }

    private static <T> Map<UUID, String> batchLabels(Collection<T> rows,
            Function<T, UUID> idOf, Function<T, String> labelOf) {
        return rows.stream().collect(Collectors.toMap(idOf, labelOf));
    }

    /**
     * Vue admin (D33) : la fiche publique sans gate published / non expirée,
     * augmentée de l'identifiant, du statut de vie et des horodatages —
     * consultation seule depuis la console d'administration.
     */
    @Transactional(readOnly = true)
    public JobOfferAdminView getAdminView(UUID offerId) {
        JobOffer offer = jobOfferRepository.findById(offerId)
                .orElseThrow(() -> {
                    log.warn("Admin offer view rejected : unknown offerId={}", offerId);
                    return new JobOfferNotFoundException("Job offer not found.");
                });
        return new JobOfferAdminView(
                offer.getId(),
                offer.getStatus().getApiValue(),
                offer.getCreatedAt(),
                offer.getUpdatedAt(),
                buildPublicResponse(offer));
    }

    @Transactional
    public void update(UUID userId, UUID offerId, UpdateJobOfferRequest request) {
        JobOffer offer =         loadForManagement(offerId, userId);
        requireEditable(offer);
        validateSalaryRange(request.salaryMin(), request.salaryMax());
        // Cohérence intrinsèque d'abord — pas de résolution de références pour un corps incohérent
        validateQuestions(request.questions());
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
        offer.setMaxClarificationQuestions(clarificationCap(request.maxClarificationQuestions()));
        offer.setUpdatedAt(LocalDateTime.now());

        replaceChildren(offerId, request.skills(), request.languages(), request.degreeIds(),
                request.studyFieldIds(), request.questions());
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
        jobOfferSkillRepository.deleteAllByJobOfferId(offerId);
        jobOfferLanguageRepository.deleteAllByJobOfferId(offerId);
        jobOfferDegreeRepository.deleteAllByJobOfferId(offerId);
        jobOfferStudyFieldRepository.deleteAllByJobOfferId(offerId);
        // Les options suivent par cascade SQL (fk_joqo_question).
        jobOfferQuestionRepository.deleteAllByJobOfferId(offerId);
        jobOfferRepository.delete(offer);
        log.info("Job offer deleted : offerId={}", offerId);
    }

    /**
     * Duplication (D20) : membre de la company (comme create — la copie est
     * un brouillon neuf attribué au duplicateur), tous statuts. Le contenu
     * est copié à l'identique (questions et options incluses — nouvelles
     * lignes, nouveaux ids, miroir D47) sauf : titre suffixé « (copy) »,
     * statut DRAFT, nouvel identifiant public, expiry réinitialisée,
     * validatedAt/publishedAt à null. Aucune revalidation des vocabulaires
     * (les FK viennent de la base).
     */
    @Transactional
    public JobOfferResponse duplicate(UUID userId, UUID offerId) {
        requireRecruiter(userId);
        JobOffer source = loadForMember(offerId, userId);

        String title = duplicateTitle(source.getTitle());
        LocalDateTime now = LocalDateTime.now();
        JobOffer copy = JobOffer.builder()
                .companyId(source.getCompanyId())
                .recruiterId(userId)
                .status(JobOfferStatus.DRAFT)
                .title(title)
                .publicId(generatePublicId())
                .slug(slugify(title))
                .description(source.getDescription())
                .seniority(source.getSeniority())
                .requiredExpYear(source.getRequiredExpYear())
                .city(source.getCity())
                .country(source.getCountry())
                .contractTypeId(source.getContractTypeId())
                .employmentTypeId(source.getEmploymentTypeId())
                .workModeId(source.getWorkModeId())
                .expiresAt(null)
                .salaryMin(source.getSalaryMin())
                .salaryMax(source.getSalaryMax())
                .salaryCurrency(source.getSalaryCurrency())
                .salaryPeriod(source.getSalaryPeriod())
                .maxClarificationQuestions(source.getMaxClarificationQuestions())
                .updatedAt(now)
                .build();
        jobOfferRepository.save(copy);

        copyChildren(offerId, copy.getId());
        log.info("Job offer duplicated : sourceId={}, offerId={}, companyId={}, recruiterId={}",
                offerId, copy.getId(), source.getCompanyId(), userId);
        return buildResponse(copy);
    }

    /**
     * Validation explicite (D13 : validate ≠ publish) : acte qui déclenche la
     * normalisation de l'offre (miroir « Validate profile »). La validation
     * n'est pas une édition : elle pose {@code validatedAt} sans toucher
     * {@code updatedAt} (miroir du heartbeat candidat), sinon le dirty-flag
     * serait faussé et le double-clic créerait deux versions. La création du
     * couple profil + job se fait dans la même tx.
     */
    @Transactional
    public void validate(UUID userId, UUID offerId) {
        transition(userId, offerId, "validate",
                status -> status == JobOfferStatus.DRAFT || status == JobOfferStatus.VALIDATED,
                offer -> {
                    offer.setStatus(JobOfferStatus.VALIDATED);
                    offer.setValidatedAt(LocalDateTime.now());
                });
        jobOfferNormalizationService.onValidated(offerId);
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
        // Lock avant tout read-check (miroir candidat) : les transitions
        // concurrentes d'une même offre sont sérialisées, pas seulement
        // validate → onValidated.
        JobOffer offer = loadForManagementForUpdate(offerId, userId);
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
        requireManagementAccess(offer, offerId, userId);
        return offer;
    }

    private JobOffer loadForManagementForUpdate(UUID offerId, UUID userId) {
        requireRecruiter(userId);
        JobOffer offer = jobOfferRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new JobOfferNotFoundException(offerId));
        requireManagementAccess(offer, offerId, userId);
        return offer;
    }

    private void requireManagementAccess(JobOffer offer, UUID offerId, UUID userId) {
        CompanyMember membership = companyMemberRepository
                .findByCompanyIdAndRecruiterId(offer.getCompanyId(), userId)
                .orElseThrow(() -> new JobOfferNotFoundException(offerId));
        boolean isOwner = Boolean.TRUE.equals(membership.getIsOwner());
        if (!isOwner && !offer.getRecruiterId().equals(userId)) {
            log.warn("Job offer management rejected : offerId={}, recruiterId={}", offerId, userId);
            throw new JobOfferAccessDeniedException(offerId, userId);
        }
    }

    /** Plafond de questions IA (D52) : absent → défaut ; bornes 0–10 validées par la requête. */
    private static int clarificationCap(Integer requested) {
        return requested == null ? JobOffer.DEFAULT_MAX_CLARIFICATION_QUESTIONS : requested;
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

    /**
     * Remplacement intégral des listes enfants (miroir des sections
     * candidat) : suppression bulk puis insertion. Les questions sont
     * insérées par étages — les options référencent leur question, le flush
     * des questions précède donc l'insertion des options (contraintes
     * IMMEDIATE, l'ordre Hibernate n'est pas garanti entre types d'entités —
     * D56). Les ids sont assignés ici (UUID aléatoires) : les options les
     * portent en FK sans attendre un retour de la base.
     */
    private void replaceChildren(UUID offerId, List<JobOfferSkillRequest> skills,
            List<JobOfferLanguageRequest> languages, List<UUID> degreeIds, List<UUID> studyFieldIds,
            List<JobOfferQuestionRequest> questions) {
        jobOfferSkillRepository.deleteAllByJobOfferId(offerId);
        jobOfferLanguageRepository.deleteAllByJobOfferId(offerId);
        jobOfferDegreeRepository.deleteAllByJobOfferId(offerId);
        jobOfferStudyFieldRepository.deleteAllByJobOfferId(offerId);
        // Les options suivent par cascade SQL (fk_joqo_question).
        jobOfferQuestionRepository.deleteAllByJobOfferId(offerId);

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
        if (!questions.isEmpty()) {
            List<JobOfferQuestion> questionRows = questions.stream()
                    .map(question -> JobOfferQuestion.builder()
                            .id(UUID.randomUUID())
                            .jobOfferId(offerId)
                            .label(question.label().trim())
                            .questionType(QuestionType.fromApiValue(question.type()))
                            .isRequired(Boolean.TRUE.equals(question.isRequired()))
                            .sortOrder(question.sortOrder())
                            .build())
                    .toList();
            jobOfferQuestionRepository.saveAllAndFlush(questionRows);

            List<JobOfferQuestionOption> optionRows = new ArrayList<>();
            for (int i = 0; i < questionRows.size(); i++) {
                UUID questionId = questionRows.get(i).getId();
                for (JobOfferQuestionOptionRequest option : questions.get(i).options()) {
                    optionRows.add(JobOfferQuestionOption.builder()
                            .id(UUID.randomUUID())
                            .questionId(questionId)
                            .label(option.label().trim())
                            .sortOrder(option.sortOrder())
                            .preferred(Boolean.TRUE.equals(option.preferred()))
                            .build());
                }
            }
            if (!optionRows.isEmpty()) {
                jobOfferQuestionOptionRepository.saveAll(optionRows);
            }
        }
    }

    /**
     * Titre de la copie : suffixe « (copy) », base tronquée pour tenir dans
     * le VARCHAR(255) du titre (7 caractères de suffixe).
     */
    private static String duplicateTitle(String title) {
        String base = title.length() > 248 ? title.substring(0, 248) : title;
        return base + " (copy)";
    }

    /**
     * D20 : recopie les associations vers la nouvelle offre (insertions
     * seules — l'inverse de replaceChildren qui nettoie d'abord).
     */
    private void copyChildren(UUID sourceId, UUID targetId) {
        List<JobOfferSkill> skills = jobOfferSkillRepository.findByJobOfferIdIn(List.of(sourceId));
        if (!skills.isEmpty()) {
            jobOfferSkillRepository.saveAll(skills.stream()
                    .map(skill -> JobOfferSkill.builder()
                            .jobOfferId(targetId)
                            .skillId(skill.getSkillId())
                            .requirementType(skill.getRequirementType())
                            .weight(skill.getWeight())
                            .yearsExperience(skill.getYearsExperience())
                            .build())
                    .toList());
        }
        List<JobOfferLanguage> languages = jobOfferLanguageRepository.findByJobOfferIdIn(List.of(sourceId));
        if (!languages.isEmpty()) {
            jobOfferLanguageRepository.saveAll(languages.stream()
                    .map(language -> JobOfferLanguage.builder()
                            .jobOfferId(targetId)
                            .languageId(language.getLanguageId())
                            .level(language.getLevel())
                            .isRequired(language.getIsRequired())
                            .build())
                    .toList());
        }
        List<JobOfferDegree> degrees = jobOfferDegreeRepository.findByJobOfferIdIn(List.of(sourceId));
        if (!degrees.isEmpty()) {
            jobOfferDegreeRepository.saveAll(degrees.stream()
                    .map(degree -> JobOfferDegree.builder()
                            .jobOfferId(targetId)
                            .degreeId(degree.getDegreeId())
                            .build())
                    .toList());
        }
        List<JobOfferStudyField> studyFields = jobOfferStudyFieldRepository.findByJobOfferIdIn(List.of(sourceId));
        if (!studyFields.isEmpty()) {
            jobOfferStudyFieldRepository.saveAll(studyFields.stream()
                    .map(studyField -> JobOfferStudyField.builder()
                            .jobOfferId(targetId)
                            .studyFieldId(studyField.getStudyFieldId())
                            .build())
                    .toList());
        }
        List<JobOfferQuestion> questions = jobOfferQuestionRepository
                .findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(sourceId));
        if (!questions.isEmpty()) {
            List<JobOfferQuestion> copies = questions.stream()
                    .map(question -> JobOfferQuestion.builder()
                            .id(UUID.randomUUID())
                            .jobOfferId(targetId)
                            .label(question.getLabel())
                            .questionType(question.getQuestionType())
                            .isRequired(question.getIsRequired())
                            .sortOrder(question.getSortOrder())
                            .build())
                    .toList();
            jobOfferQuestionRepository.saveAllAndFlush(copies);

            Map<UUID, UUID> questionCopyIds = new HashMap<>();
            for (int i = 0; i < questions.size(); i++) {
                questionCopyIds.put(questions.get(i).getId(), copies.get(i).getId());
            }
            List<JobOfferQuestionOption> options = jobOfferQuestionOptionRepository
                    .findByQuestionIdInOrderBySortOrderAscIdAsc(questions.stream()
                            .map(JobOfferQuestion::getId)
                            .toList());
            if (!options.isEmpty()) {
                jobOfferQuestionOptionRepository.saveAll(options.stream()
                        .map(option -> JobOfferQuestionOption.builder()
                                .id(UUID.randomUUID())
                                .questionId(questionCopyIds.get(option.getQuestionId()))
                                .label(option.getLabel())
                                .sortOrder(option.getSortOrder())
                                .preferred(option.getPreferred())
                                .build())
                        .toList());
            }
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
        requireAllExist(degreeIds, degreeRepository::countByIdIn, degreeRepository::existsById, "degree");
        requireAllExist(studyFieldIds, studyFieldRepository::countByIdIn, studyFieldRepository::existsById,
                "study field");
        requireExists(contractTypeId, contractTypeRepository::existsById, "contract type");
        requireExists(employmentTypeId, employmentTypeRepository::existsById, "employment type");
        requireExists(workModeId, workModeRepository::existsById, "work mode");
    }

    /**
     * Questions de présélection (D47) : le type est parsé (5 valeurs API —
     * inconnu → 400 référence), et la cohérence type/options est vérifiée
     * (la base ne lit pas question_type) : une question à choix exige au
     * moins une option, les autres types n'en admettent aucune.
     */
    private void validateQuestions(List<JobOfferQuestionRequest> questions) {
        for (JobOfferQuestionRequest question : questions) {
            QuestionType type;
            try {
                type = QuestionType.fromApiValue(question.type());
            } catch (IllegalArgumentException ex) {
                throw new JobOfferReferenceNotFoundException("question type", question.type());
            }
            boolean hasOptions = !question.options().isEmpty();
            if (type.isChoice() && !hasOptions) {
                throw new InvalidJobOfferException("Choice questions must have at least one option.");
            }
            if (!type.isChoice() && hasOptions) {
                throw new InvalidJobOfferException("Options are only allowed on choice questions.");
            }
        }
    }

    private void requireAllSkillsExist(List<JobOfferSkillRequest> skills) {        Set<UUID> requested = skills.stream()
                .map(JobOfferSkillRequest::skillId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        requireAllExist(requested, skillRepository::countByIdIn, skillRepository::existsById, "skill");
    }

    private void requireAllLanguagesExist(List<JobOfferLanguageRequest> languages) {
        Set<UUID> requested = languages.stream()
                .map(JobOfferLanguageRequest::languageId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        requireAllExist(requested, languageRepository::countByIdIn, languageRepository::existsById, "language");
    }

    /**
     * Vérification en masse (TD-023) : une seule requête COUNT par collection
     * au lieu de N existsById. Le chemin d'échec (rare) reboucle en existsById
     * pour nommer précisément l'inconnu — contrat de message inchangé.
     */
    private void requireAllExist(Collection<UUID> ids, CountById countById, Predicate<UUID> exists,
            String resource) {
        Set<UUID> distinct = ids.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (distinct.isEmpty() || countById.count(distinct) == distinct.size()) {
            return;
        }
        for (UUID id : distinct) {
            if (!exists.test(id)) {
                throw new JobOfferReferenceNotFoundException(resource, id);
            }
        }
    }

    @FunctionalInterface
    private interface CountById {
        long count(Collection<UUID> ids);
    }

    private static void requireExists(UUID id, Predicate<UUID> exists, String resource) {
        if (id != null && !exists.test(id)) {
            throw new JobOfferReferenceNotFoundException(resource, id);
        }
    }

    /**
     * Lignes de la liste (D34) : ni description, ni listes enfants — seuls
     * le statut du dernier job et la présence d'au moins un skill (gate de
     * complétude {@code readyToPublish}, miroir du frontend) sont joints.
     */
    private List<JobOfferListItem> buildListItems(List<JobOffer> offers) {
        if (offers.isEmpty()) {
            return List.of();
        }
        List<UUID> offerIds = offers.stream().map(JobOffer::getId).toList();
        Set<UUID> withSkills = new LinkedHashSet<>(jobOfferSkillRepository.findOfferIdsWithSkills(offerIds));
        Map<UUID, NormalizationJobStatus> latestStatuses = latestJobStatuses(offerIds);

        return offers.stream()
                .map(offer -> new JobOfferListItem(
                        offer.getId(),
                        offer.getCompanyId(),
                        offer.getStatus().getApiValue(),
                        offer.getTitle(),
                        offer.getPublicId(),
                        offer.getSlug(),
                        offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                        offer.getCity(),
                        offer.getCountry(),
                        offer.getContractTypeId(),
                        offer.getEmploymentTypeId(),
                        offer.getWorkModeId(),
                        offer.getExpiresAt(),
                        offer.getSalaryMin(),
                        offer.getSalaryMax(),
                        offer.getSalaryCurrency(),
                        offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                        (offer.getStatus() == JobOfferStatus.DRAFT
                                 || offer.getStatus() == JobOfferStatus.VALIDATED)
                                 && offer.getValidatedAt() != null
                                 && offer.getUpdatedAt() != null
                                 && offer.getUpdatedAt().isAfter(offer.getValidatedAt()),
                        isInProgress(latestStatuses.get(offer.getId())),
                        latestStatuses.get(offer.getId()) == NormalizationJobStatus.FAILED,
                        offer.getDescription() != null
                                && offer.getCountry() != null
                                && offer.getEmploymentTypeId() != null
                                && withSkills.contains(offer.getId()),
                        offer.getCreatedAt(),
                        offer.getUpdatedAt()))
                .toList();
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
        List<JobOfferQuestion> questions = jobOfferQuestionRepository
                .findByJobOfferIdInOrderBySortOrderAscIdAsc(offerIds);
        List<JobOfferQuestionOption> questionOptions = questions.isEmpty() ? List.of()
                : jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(
                        questions.stream().map(JobOfferQuestion::getId).toList());

        Map<UUID, Skill> skillMap = loadSkills(skills);
        Map<UUID, Language> languageMap = loadLanguages(languages);

        Map<UUID, List<JobOfferSkill>> skillsByOffer = groupBy(skills, JobOfferSkill::getJobOfferId);
        Map<UUID, List<JobOfferLanguage>> languagesByOffer = groupBy(languages, JobOfferLanguage::getJobOfferId);
        Map<UUID, List<JobOfferDegree>> degreesByOffer = groupBy(degrees, JobOfferDegree::getJobOfferId);
        Map<UUID, List<JobOfferStudyField>> studyFieldsByOffer = groupBy(studyFields, JobOfferStudyField::getJobOfferId);
        Map<UUID, List<JobOfferQuestion>> questionsByOffer = groupBy(questions, JobOfferQuestion::getJobOfferId);
        Map<UUID, List<JobOfferQuestionOption>> optionsByQuestion = groupBy(questionOptions,
                JobOfferQuestionOption::getQuestionId);
        Map<UUID, NormalizationJobStatus> latestStatuses = latestJobStatuses(offerIds);

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
                        offer.getMaxClarificationQuestions(),
                        // D13 : le dirty-flag n'a de sens que sur un statut éditable —
                        // publish/close posent updatedAt après validatedAt et fausseraient
                        // le signal sur PUBLISHED/CLOSED (lecture seule).
                        (offer.getStatus() == JobOfferStatus.DRAFT
                                 || offer.getStatus() == JobOfferStatus.VALIDATED)
                                 && offer.getValidatedAt() != null
                                 && offer.getUpdatedAt() != null
                                 && offer.getUpdatedAt().isAfter(offer.getValidatedAt()),
                         isInProgress(latestStatuses.get(offer.getId())),
                         latestStatuses.get(offer.getId()) == NormalizationJobStatus.FAILED,
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
                        questionsByOffer.getOrDefault(offer.getId(), List.of()).stream()
                                .map(question -> new JobOfferQuestionView(
                                        question.getId(),
                                        question.getLabel(),
                                        question.getQuestionType().getApiValue(),
                                        Boolean.TRUE.equals(question.getIsRequired()),
                                        question.getSortOrder(),
                                        optionsByQuestion.getOrDefault(question.getId(), List.of()).stream()
                                                .map(option -> new JobOfferQuestionOptionView(
                                                        option.getId(),
                                                        option.getLabel(),
                                                        option.getSortOrder(),
                                                        Boolean.TRUE.equals(option.getPreferred())))
                                                .toList()))
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

    /**
     * Statut du job de la dernière version de chaque offre, en une seule
     * requête (pas de N+1 sur les signaux d'affichage de la liste).
     */
    private Map<UUID, NormalizationJobStatus> latestJobStatuses(List<UUID> offerIds) {
        if (offerIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, NormalizationJobStatus> statuses = new HashMap<>();
        for (Object[] row : normalizedProfileJobOfferRepository.findLatestJobStatuses(offerIds)) {
            statuses.put((UUID) row[0], (NormalizationJobStatus) row[1]);
        }
        return statuses;
    }

    private static boolean isInProgress(NormalizationJobStatus status) {
        return status == NormalizationJobStatus.PENDING || status == NormalizationJobStatus.RUNNING;
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
