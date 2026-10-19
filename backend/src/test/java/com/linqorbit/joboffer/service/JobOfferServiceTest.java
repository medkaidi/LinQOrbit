package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.repository.CompanyMemberRepository;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferListItem;
import com.linqorbit.joboffer.dto.JobOfferPageResponse;
import com.linqorbit.joboffer.dto.JobOfferQuestionOptionRequest;
import com.linqorbit.joboffer.dto.JobOfferQuestionRequest;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.PublicJobListItem;
import com.linqorbit.joboffer.dto.PublicJobPageResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.entity.ContractType;
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
 * Logique métier des offres (D12–D14) : permissions coarse (membre = lecture +
 * création, owner ou créateur = gestion), transitions D13, vocabulaires D14,
 * fourchette salariale.
 */
class JobOfferServiceTest {

    private static final UUID RECRUITER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID OTHER_RECRUITER_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID COMPANY_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID COPY_ID = UUID.fromString("55555555-5555-4555-8555-555555555555");
    private static final UUID SKILL_ID = UUID.fromString("a0000000-0000-4000-8000-000000000001");
    private static final UUID SKILL_AWS_ID = UUID.fromString("a0000000-0000-4000-8000-000000000023");
    private static final UUID SKILL_K8S_ID = UUID.fromString("a0000000-0000-4000-8000-000000000020");
    private static final UUID UNKNOWN_SKILL_ID = UUID.fromString("a0000000-0000-4000-8000-0000000000ff");
    private static final UUID LANGUAGE_ID = UUID.fromString("b0000000-0000-4000-8000-000000000002");
    private static final UUID DEGREE_ID = UUID.fromString("c0000000-0000-4000-8000-000000000003");
    private static final UUID STUDY_FIELD_ID = UUID.fromString("d0000000-0000-4000-8000-000000000001");
    private static final UUID CONTRACT_TYPE_ID = UUID.fromString("b0000000-0000-4000-8000-000000000001");
    private static final UUID WORK_MODE_ID = UUID.fromString("b2000000-0000-4000-8000-000000000001");
    private static final UUID QUESTION_ID = UUID.fromString("e0000000-0000-4000-8000-000000000001");
    private static final UUID OPTION_ID = UUID.fromString("e1000000-0000-4000-8000-000000000001");

    private JobOfferRepository jobOfferRepository;
    private JobOfferSkillRepository jobOfferSkillRepository;
    private JobOfferLanguageRepository jobOfferLanguageRepository;
    private JobOfferDegreeRepository jobOfferDegreeRepository;
    private JobOfferStudyFieldRepository jobOfferStudyFieldRepository;
    private JobOfferQuestionRepository jobOfferQuestionRepository;
    private JobOfferQuestionOptionRepository jobOfferQuestionOptionRepository;
    private CompanyMemberRepository companyMemberRepository;
    private CompanyRepository companyRepository;
    private RecruiterRepository recruiterRepository;
    private SkillRepository skillRepository;
    private LanguageRepository languageRepository;
    private DegreeRepository degreeRepository;
    private StudyFieldRepository studyFieldRepository;
    private ContractTypeRepository contractTypeRepository;
    private EmploymentTypeRepository employmentTypeRepository;
    private WorkModeRepository workModeRepository;
    private JobOfferService jobOfferService;
    private JobOfferNormalizationService jobOfferNormalizationService;

    @BeforeEach
    void setUp() {
        jobOfferRepository = mock(JobOfferRepository.class);
        jobOfferSkillRepository = mock(JobOfferSkillRepository.class);
        jobOfferLanguageRepository = mock(JobOfferLanguageRepository.class);
        jobOfferDegreeRepository = mock(JobOfferDegreeRepository.class);
        jobOfferStudyFieldRepository = mock(JobOfferStudyFieldRepository.class);
        jobOfferQuestionRepository = mock(JobOfferQuestionRepository.class);
        jobOfferQuestionOptionRepository = mock(JobOfferQuestionOptionRepository.class);
        companyMemberRepository = mock(CompanyMemberRepository.class);
        companyRepository = mock(CompanyRepository.class);
        recruiterRepository = mock(RecruiterRepository.class);
        skillRepository = mock(SkillRepository.class);
        languageRepository = mock(LanguageRepository.class);
        degreeRepository = mock(DegreeRepository.class);
        studyFieldRepository = mock(StudyFieldRepository.class);
        contractTypeRepository = mock(ContractTypeRepository.class);
        employmentTypeRepository = mock(EmploymentTypeRepository.class);
        workModeRepository = mock(WorkModeRepository.class);
        jobOfferNormalizationService = mock(JobOfferNormalizationService.class);
        jobOfferService = new JobOfferService(
                jobOfferRepository, jobOfferSkillRepository, jobOfferLanguageRepository,
                jobOfferDegreeRepository, jobOfferStudyFieldRepository,
                jobOfferQuestionRepository, jobOfferQuestionOptionRepository,
                companyMemberRepository,
                companyRepository, recruiterRepository, skillRepository, languageRepository, degreeRepository,
                studyFieldRepository, contractTypeRepository, employmentTypeRepository, workModeRepository,
                mock(NormalizedProfileJobOfferRepository.class),
                jobOfferNormalizationService);

        lenient().when(jobOfferSkillRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferLanguageRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferDegreeRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferStudyFieldRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(any()))
                .thenReturn(List.of());
    }

    @Test
    void createCreeUneOffreDraftEnMembre() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(1L);
        when(contractTypeRepository.existsById(CONTRACT_TYPE_ID)).thenReturn(true);
        when(jobOfferRepository.save(any(JobOffer.class))).thenAnswer(invocation -> {
            JobOffer offer = invocation.getArgument(0);
            offer.setId(OFFER_ID);
            return offer;
        });

        JobOfferResponse response = jobOfferService.create(RECRUITER_ID, createRequest());

        assertThat(response.id()).isEqualTo(OFFER_ID);
        assertThat(response.status()).isEqualTo("draft");
        assertThat(response.companyId()).isEqualTo(COMPANY_ID);
        assertThat(response.recruiterId()).isEqualTo(RECRUITER_ID);
        assertThat(response.title()).isEqualTo("Backend Engineer");
    }

    @Test
    void createRejetteUnNonMembre() {
        stubRecruiter(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, RECRUITER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, createRequest()))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void createRejetteUnSkillInconnu() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(0L);
        when(skillRepository.existsById(SKILL_ID)).thenReturn(false);

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, createRequest()))
                .isInstanceOf(JobOfferReferenceNotFoundException.class);
    }

    @Test
    void createRejetteUneFourchetteSalaireIncoherente() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);

        CreateJobOfferRequest request = new CreateJobOfferRequest(
                COMPANY_ID, "Backend Engineer", null, null, null, null, null,
                null, null, null, null,
                new BigDecimal("90000"), new BigDecimal("70000"), "EUR", "year",
                List.of(), List.of(), List.of(), List.of(), List.of(), null);

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, request))
                .isInstanceOf(InvalidJobOfferException.class);
    }

    @Test
    void createRejetteUnCompteSansProfilRecruteur() {
        stubRecruiter(false);

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, createRequest()))
                .isInstanceOf(RecruiterNotFoundException.class);
    }

    @Test
    void updateAutoriseLeCreateurEtRejetteUnAutreMembre() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        jobOfferService.update(RECRUITER_ID, OFFER_ID, updateRequest("Senior Backend Engineer"));
        verify(jobOfferRepository).save(offer);
        assertThat(offer.getTitle()).isEqualTo("Senior Backend Engineer");

        stubMembership(OTHER_RECRUITER_ID, false);
        assertThatThrownBy(() -> jobOfferService.update(OTHER_RECRUITER_ID, OFFER_ID, updateRequest("Hijacked")))
                .isInstanceOf(JobOfferAccessDeniedException.class);
    }

    @Test
    void updateAutoriseLOwnerMaisRejetteLePublie() {
        JobOffer offer = draftOffer();
        stubManagement(offer, OTHER_RECRUITER_ID, true);

        jobOfferService.update(OTHER_RECRUITER_ID, OFFER_ID, updateRequest("Owner edit"));

        offer.setStatus(JobOfferStatus.PUBLISHED);
        assertThatThrownBy(() -> jobOfferService.update(OTHER_RECRUITER_ID, OFFER_ID, updateRequest("Nope")))
                .isInstanceOf(InvalidJobOfferStatusException.class);
    }

    @Test
    void deleteRejetteToutSaufLeDraft() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        jobOfferService.delete(RECRUITER_ID, OFFER_ID);
        verify(jobOfferRepository).delete(offer);

        offer.setStatus(JobOfferStatus.VALIDATED);
        assertThatThrownBy(() -> jobOfferService.delete(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(InvalidJobOfferStatusException.class);
    }

    @Test
    void duplicateCopieLeContenuEnDraftMemeParUnMembreNonCreateur() {
        JobOffer source = publishedOffer();
        stubRecruiter(true);
        stubDuplicateSource(source, OTHER_RECRUITER_ID);
        when(jobOfferSkillRepository.findByJobOfferIdIn(List.of(OFFER_ID)))
                .thenReturn(List.of(JobOfferSkill.builder()
                        .jobOfferId(OFFER_ID).skillId(SKILL_ID)
                        .requirementType(RequirementType.MANDATORY).weight(3).yearsExperience(2)
                        .build()));
        when(jobOfferLanguageRepository.findByJobOfferIdIn(List.of(OFFER_ID)))
                .thenReturn(List.of(JobOfferLanguage.builder()
                        .jobOfferId(OFFER_ID).languageId(LANGUAGE_ID)
                        .level("B2").isRequired(true)
                        .build()));
        when(jobOfferDegreeRepository.findByJobOfferIdIn(List.of(OFFER_ID)))
                .thenReturn(List.of(JobOfferDegree.builder()
                        .jobOfferId(OFFER_ID).degreeId(DEGREE_ID)
                        .build()));
        when(jobOfferStudyFieldRepository.findByJobOfferIdIn(List.of(OFFER_ID)))
                .thenReturn(List.of(JobOfferStudyField.builder()
                        .jobOfferId(OFFER_ID).studyFieldId(STUDY_FIELD_ID)
                        .build()));
        when(jobOfferRepository.save(any(JobOffer.class))).thenAnswer(invocation -> {
            JobOffer copy = invocation.getArgument(0);
            copy.setId(COPY_ID);
            return copy;
        });

        JobOfferResponse response = jobOfferService.duplicate(OTHER_RECRUITER_ID, OFFER_ID);

        assertThat(response.id()).isEqualTo(COPY_ID);
        assertThat(response.status()).isEqualTo("draft");
        assertThat(response.companyId()).isEqualTo(COMPANY_ID);
        assertThat(response.recruiterId()).isEqualTo(OTHER_RECRUITER_ID);
        assertThat(response.title()).isEqualTo("Backend Engineer (copy)");
        assertThat(response.slug()).isEqualTo("backend-engineer-copy");
        assertThat(response.publicId()).isNotEqualTo("abcdefghijkl");
        assertThat(response.description()).isEqualTo("Build APIs");
        assertThat(response.country()).isEqualTo("FR");
        assertThat(response.expiresAt()).isNull();
        assertThat(response.validatedAt()).isNull();
        assertThat(response.publishedAt()).isNull();
        verify(jobOfferSkillRepository).saveAll(argThat(all -> {
            List<JobOfferSkill> skills = asList(all);
            return skills.size() == 1 && skills.get(0).getJobOfferId().equals(COPY_ID)
                    && skills.get(0).getSkillId().equals(SKILL_ID)
                    && skills.get(0).getRequirementType() == RequirementType.MANDATORY
                    && skills.get(0).getWeight() == 3
                    && skills.get(0).getYearsExperience() == 2;
        }));
        verify(jobOfferLanguageRepository).saveAll(argThat(all -> {
            List<JobOfferLanguage> languages = asList(all);
            return languages.size() == 1 && languages.get(0).getJobOfferId().equals(COPY_ID)
                    && languages.get(0).getLanguageId().equals(LANGUAGE_ID)
                    && languages.get(0).getLevel().equals("B2")
                    && Boolean.TRUE.equals(languages.get(0).getIsRequired());
        }));
        verify(jobOfferDegreeRepository).saveAll(argThat(all -> {
            List<JobOfferDegree> degrees = asList(all);
            return degrees.size() == 1 && degrees.get(0).getJobOfferId().equals(COPY_ID)
                    && degrees.get(0).getDegreeId().equals(DEGREE_ID);
        }));
        verify(jobOfferStudyFieldRepository).saveAll(argThat(all -> {
            List<JobOfferStudyField> fields = asList(all);
            return fields.size() == 1 && fields.get(0).getJobOfferId().equals(COPY_ID)
                    && fields.get(0).getStudyFieldId().equals(STUDY_FIELD_ID);
        }));
    }

    @Test
    void duplicateRejetteUnNonMembre() {
        stubRecruiter(true);
        when(companyMemberRepository.findByRecruiterId(RECRUITER_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> jobOfferService.duplicate(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void duplicateRejetteUnCompteSansProfilRecruteur() {
        stubRecruiter(false);

        assertThatThrownBy(() -> jobOfferService.duplicate(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(RecruiterNotFoundException.class);
    }

    @Test
    void duplicateTronqueUnTitreDe255Caracteres() {
        JobOffer source = publishedOffer();
        source.setTitle("a".repeat(255));
        stubRecruiter(true);
        stubDuplicateSource(source, RECRUITER_ID);
        when(jobOfferRepository.save(any(JobOffer.class))).thenAnswer(invocation -> {
            JobOffer copy = invocation.getArgument(0);
            copy.setId(COPY_ID);
            return copy;
        });

        JobOfferResponse response = jobOfferService.duplicate(RECRUITER_ID, OFFER_ID);

        assertThat(response.title()).hasSize(255);
        assertThat(response.title()).endsWith(" (copy)");
    }

    @Test
    void validatePasseEnValidatedEtPoseValidatedAt() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        jobOfferService.validate(RECRUITER_ID, OFFER_ID);

        assertThat(offer.getStatus()).isEqualTo(JobOfferStatus.VALIDATED);
        assertThat(offer.getValidatedAt()).isNotNull();
        // La validation n'est pas une édition : updatedAt est inchangé (le
        // dirty-flag compare updatedAt à validatedAt — un bump ici créerait
        // un faux positif et un doublon de version au double-clic).
        assertThat(offer.getUpdatedAt()).isNull();
    }

    // --- D63 : rafraîchissement de l'analyse d'une offre PUBLISHED -----------

    @Test
    void revalidateDelegueALaNormalisationSansToucherAuCycleDeVie() {
        JobOffer offer = publishedOffer();
        LocalDateTime updatedAt = LocalDateTime.now().minusHours(3);
        offer.setUpdatedAt(updatedAt);
        LocalDateTime validatedAt = offer.getValidatedAt();
        LocalDateTime publishedAt = offer.getPublishedAt();
        stubManagement(offer, RECRUITER_ID, false);

        jobOfferService.revalidate(RECRUITER_ID, OFFER_ID);

        verify(jobOfferNormalizationService).onValidated(OFFER_ID);
        assertThat(offer.getStatus()).isEqualTo(JobOfferStatus.PUBLISHED);
        assertThat(offer.getValidatedAt()).isEqualTo(validatedAt);
        assertThat(offer.getPublishedAt()).isEqualTo(publishedAt);
        assertThat(offer.getUpdatedAt()).isEqualTo(updatedAt);
        verify(jobOfferRepository, never()).save(any());
    }

    @Test
    void revalidateAutoriseLOwnerDeLaCompany() {
        JobOffer offer = publishedOffer();
        stubManagement(offer, OTHER_RECRUITER_ID, true);

        jobOfferService.revalidate(OTHER_RECRUITER_ID, OFFER_ID);

        verify(jobOfferNormalizationService).onValidated(OFFER_ID);
    }

    @Test
    void revalidateRejetteToutStatutAutreQuePublie() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        for (JobOfferStatus status : List.of(JobOfferStatus.DRAFT, JobOfferStatus.VALIDATED, JobOfferStatus.CLOSED)) {
            offer.setStatus(status);
            assertThatThrownBy(() -> jobOfferService.revalidate(RECRUITER_ID, OFFER_ID))
                    .isInstanceOf(InvalidJobOfferStatusException.class);
            assertThat(offer.getStatus()).isEqualTo(status);
        }
        verify(jobOfferNormalizationService, never()).onValidated(any());
    }

    @Test
    void revalidateRejetteUnMembreQuiNEstNiOwnerNiCreateur() {
        JobOffer offer = publishedOffer();
        stubManagement(offer, OTHER_RECRUITER_ID, false);

        assertThatThrownBy(() -> jobOfferService.revalidate(OTHER_RECRUITER_ID, OFFER_ID))
                .isInstanceOf(JobOfferAccessDeniedException.class);
        verify(jobOfferNormalizationService, never()).onValidated(any());
    }

    @Test
    void revalidateRepond404HorsDeLaCompanyOuSurUneOffreInconnue() {
        stubRecruiter(true);
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.of(publishedOffer()));
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, OTHER_RECRUITER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> jobOfferService.revalidate(OTHER_RECRUITER_ID, OFFER_ID))
                .isInstanceOf(JobOfferNotFoundException.class);

        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> jobOfferService.revalidate(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(JobOfferNotFoundException.class);
        verify(jobOfferNormalizationService, never()).onValidated(any());
    }

    @Test
    void publishExigeValidatedEtCloseExigeValidatedOuPublished() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        assertThatThrownBy(() -> jobOfferService.publish(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(InvalidJobOfferStatusException.class);
        assertThatThrownBy(() -> jobOfferService.close(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(InvalidJobOfferStatusException.class);

        offer.setStatus(JobOfferStatus.VALIDATED);
        jobOfferService.publish(RECRUITER_ID, OFFER_ID);
        assertThat(offer.getStatus()).isEqualTo(JobOfferStatus.PUBLISHED);
        assertThat(offer.getPublishedAt()).isNotNull();

        jobOfferService.close(RECRUITER_ID, OFFER_ID);
        assertThat(offer.getStatus()).isEqualTo(JobOfferStatus.CLOSED);

        assertThatThrownBy(() -> jobOfferService.close(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(InvalidJobOfferStatusException.class);
    }

    @Test
    void getRejetteUnCompteSansAucuneCompany() {
        stubRecruiter(true);
        when(companyMemberRepository.findByRecruiterId(RECRUITER_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> jobOfferService.get(RECRUITER_ID, OFFER_ID))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void listMineRenvoieDesLignesLegeresSansChargerLesEnfants() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, false);
        JobOffer complete = JobOffer.builder()
                .id(OFFER_ID).companyId(COMPANY_ID).recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.DRAFT).title("Backend Engineer")
                .publicId("abcdefghijkl").slug("backend-engineer")
                .description("Build APIs").country("FR").employmentTypeId(UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .build();
        JobOffer incomplete = JobOffer.builder()
                .id(COPY_ID).companyId(COMPANY_ID).recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.DRAFT).title("Frontend Engineer")
                .build();
        when(jobOfferRepository.findByCompanyIdIn(eq(List.of(COMPANY_ID)), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(complete, incomplete), PageRequest.of(0, 20), 2));
        when(jobOfferSkillRepository.findOfferIdsWithSkills(List.of(OFFER_ID, COPY_ID)))
                .thenReturn(List.of(OFFER_ID));

        JobOfferPageResponse response = jobOfferService.listMine(RECRUITER_ID, null, null);

        assertThat(response.items()).hasSize(2);
        JobOfferListItem first = response.items().get(0);
        assertThat(first.title()).isEqualTo("Backend Engineer");
        assertThat(first.readyToPublish()).isTrue();
        assertThat(first.hasUnvalidatedChanges()).isFalse();
        assertThat(first.employmentTypeId()).isNotNull();
        assertThat(first.updatedAt()).isNull();
        assertThat(response.items().get(1).readyToPublish()).isFalse();
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(20);
        assertThat(response.total()).isEqualTo(2);
        // Lignes légères : ni lignes enfants ni catalogues chargés pour la liste.
        verify(jobOfferSkillRepository, never()).findByJobOfferIdIn(any());
        verify(jobOfferLanguageRepository, never()).findByJobOfferIdIn(any());
        verify(jobOfferDegreeRepository, never()).findByJobOfferIdIn(any());
        verify(jobOfferStudyFieldRepository, never()).findByJobOfferIdIn(any());
    }

    @Test
    void listMineBorneLaPagination() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, false);
        when(jobOfferRepository.findByCompanyIdIn(eq(List.of(COMPANY_ID)), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        JobOfferPageResponse response = jobOfferService.listMine(RECRUITER_ID, -3, 500);

        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(50);
    }

    @Test
    void listMineSansCompanyRenvoieUnePageVide() {
        stubRecruiter(true);
        when(companyMemberRepository.findByRecruiterId(RECRUITER_ID)).thenReturn(List.of());

        JobOfferPageResponse response = jobOfferService.listMine(RECRUITER_ID, null, 10);

        assertThat(response.items()).isEmpty();
        assertThat(response.size()).isEqualTo(10);
        assertThat(response.total()).isZero();
        verify(jobOfferRepository, never()).findByCompanyIdIn(any(), any());
    }

    @Test
    void listPublicResoutLesLabelsEnBatchEtExposeToutesLesCompetencesTriees() {
        JobOffer published = JobOffer.builder()
                .id(OFFER_ID).companyId(COMPANY_ID).recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.PUBLISHED).title("Backend Engineer")
                .publicId("abcdefghijkl").slug("backend-engineer")
                .contractTypeId(CONTRACT_TYPE_ID).workModeId(WORK_MODE_ID)
                .city("Paris").country("FR")
                .publishedAt(LocalDateTime.now())
                .build();
        when(jobOfferRepository.findPublic(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(published), PageRequest.of(0, 20), 1));
        when(companyRepository.findAllById(List.of(COMPANY_ID)))
                .thenReturn(List.of(Company.builder().id(COMPANY_ID).name("Acme").build()));
        when(contractTypeRepository.findAllById(List.of(CONTRACT_TYPE_ID)))
                .thenReturn(List.of(ContractType.builder().id(CONTRACT_TYPE_ID).label("Full-time").build()));
        when(workModeRepository.findAllById(List.of(WORK_MODE_ID)))
                .thenReturn(List.of(WorkMode.builder().id(WORK_MODE_ID).label("Remote").build()));
        when(jobOfferSkillRepository.findByJobOfferIdIn(List.of(OFFER_ID))).thenReturn(List.of(
                JobOfferSkill.builder().jobOfferId(OFFER_ID).skillId(SKILL_ID).weight(2).build(),
                JobOfferSkill.builder().jobOfferId(OFFER_ID).skillId(SKILL_AWS_ID).weight(5).build(),
                JobOfferSkill.builder().jobOfferId(OFFER_ID).skillId(UNKNOWN_SKILL_ID).weight(4).build(),
                JobOfferSkill.builder().jobOfferId(OFFER_ID).skillId(SKILL_K8S_ID).weight(5).build()));
        when(skillRepository.findAllById(any())).thenReturn(List.of(
                Skill.builder().id(SKILL_ID).name("Java").build(),
                Skill.builder().id(SKILL_AWS_ID).name("AWS").build(),
                Skill.builder().id(SKILL_K8S_ID).name("Kubernetes").build()));

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        PublicJobPageResponse response = jobOfferService.listPublic(1);

        verify(jobOfferRepository).findPublic(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class),
                pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
        assertThat(pageable.getValue().getSort())
                .isEqualTo(Sort.by(Sort.Direction.DESC, "publishedAt"));
        assertThat(response.items()).hasSize(1);
        PublicJobListItem item = response.items().get(0);
        assertThat(item.title()).isEqualTo("Backend Engineer");
        assertThat(item.companyName()).isEqualTo("Acme");
        assertThat(item.contractType()).isEqualTo("Full-time");
        assertThat(item.workMode()).isEqualTo("Remote");
        assertThat(item.employmentType()).isNull();
        // Toutes les compétences, poids décroissant puis nom (poids égal) ; le
        // libellé introuvable au vocabulaire est ignoré.
        assertThat(item.skills()).containsExactly("AWS", "Kubernetes", "Java");
        assertThat(response.total()).isEqualTo(1);
        // Ligne légère : batches uniquement, jamais de requête par entité.
        verify(jobOfferSkillRepository, times(1)).findByJobOfferIdIn(List.of(OFFER_ID));
        verify(skillRepository, times(1)).findAllById(any());
        verify(companyRepository, never()).findById(any());
        verify(contractTypeRepository, never()).findById(any());
    }

    @Test
    void listPublicExposeUneListeVideDeCompetencesSansLigne() {
        JobOffer published = JobOffer.builder()
                .id(OFFER_ID).companyId(COMPANY_ID).recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.PUBLISHED).title("Backend Engineer")
                .publicId("abcdefghijkl").slug("backend-engineer")
                .publishedAt(LocalDateTime.now())
                .build();
        when(jobOfferRepository.findPublic(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(published), PageRequest.of(0, 20), 1));
        when(companyRepository.findAllById(List.of(COMPANY_ID)))
                .thenReturn(List.of(Company.builder().id(COMPANY_ID).name("Acme").build()));

        PublicJobPageResponse response = jobOfferService.listPublic(0);

        assertThat(response.items().get(0).skills()).isEmpty();
        verify(jobOfferSkillRepository).findByJobOfferIdIn(List.of(OFFER_ID));
        verify(skillRepository, never()).findAllById(any());
    }

    @Test
    void listPublicBorneLaPageNegative() {
        when(jobOfferRepository.findPublic(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        PublicJobPageResponse response = jobOfferService.listPublic(-3);

        assertThat(response.items()).isEmpty();
        assertThat(response.total()).isZero();
        verify(jobOfferRepository).findPublic(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class),
                argThat(pageable -> pageable.getPageNumber() == 0 && pageable.getPageSize() == 20));
    }

    @Test
    void createAvecQuestionsSupprimePuisInsereParEtages() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(1L);
        when(contractTypeRepository.existsById(CONTRACT_TYPE_ID)).thenReturn(true);
        when(jobOfferRepository.save(any(JobOffer.class))).thenAnswer(invocation -> {
            JobOffer offer = invocation.getArgument(0);
            offer.setId(OFFER_ID);
            return offer;
        });

        jobOfferService.create(RECRUITER_ID, createRequestWithQuestions());

        // Remplacement intégral : suppression bulk avant insertion (jamais l'inverse).
        InOrder questionOrder = inOrder(jobOfferQuestionRepository);
        questionOrder.verify(jobOfferQuestionRepository).deleteAllByJobOfferId(OFFER_ID);
        questionOrder.verify(jobOfferQuestionRepository).saveAllAndFlush(any());

        ArgumentCaptor<List<JobOfferQuestion>> questionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(jobOfferQuestionRepository).saveAllAndFlush(questionsCaptor.capture());
        List<JobOfferQuestion> questions = questionsCaptor.getValue();
        assertThat(questions).hasSize(2);
        assertThat(questions.get(0).getId()).isNotNull();
        assertThat(questions.get(0).getLabel()).isEqualTo("How many years with Java?");
        assertThat(questions.get(0).getQuestionType()).isEqualTo(QuestionType.NUMBER);
        assertThat(questions.get(0).getIsRequired()).isFalse();
        assertThat(questions.get(0).getSortOrder()).isZero();

        ArgumentCaptor<List<JobOfferQuestionOption>> optionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(jobOfferQuestionOptionRepository).saveAll(optionsCaptor.capture());
        List<JobOfferQuestionOption> options = optionsCaptor.getValue();
        assertThat(options).hasSize(2);
        assertThat(options).allSatisfy(option -> {
            assertThat(option.getId()).isNotNull();
            assertThat(option.getQuestionId()).isEqualTo(questions.get(1).getId());
        });
        assertThat(options.get(0).getLabel()).isEqualTo("On-site");
        assertThat(options.get(0).getSortOrder()).isZero();
        assertThat(options.get(0).getPreferred()).isFalse();
        assertThat(options.get(1).getPreferred()).isTrue();
    }

    @Test
    void createRejetteUnTypeDeQuestionInconnu() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(1L);

        CreateJobOfferRequest request = requestWithQuestions(List.of(
                new JobOfferQuestionRequest("Rate your level", "scale", false, 0, List.of())));

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, request))
                .isInstanceOf(JobOfferReferenceNotFoundException.class);
        verify(jobOfferQuestionRepository, never()).saveAllAndFlush(any());
    }

    @Test
    void createRejetteUneQuestionChoixSansOption() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(1L);

        CreateJobOfferRequest request = requestWithQuestions(List.of(
                new JobOfferQuestionRequest("Where?", "single_choice", false, 0, List.of())));

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, request))
                .isInstanceOf(InvalidJobOfferException.class)
                .hasMessage("Choice questions must have at least one option.");
    }

    @Test
    void createRejetteDesOptionsSurUneQuestionHorsChoix() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.countByIdIn(any())).thenReturn(1L);

        CreateJobOfferRequest request = requestWithQuestions(List.of(
                new JobOfferQuestionRequest("Tell us more", "text", false, 0,
                        List.of(new JobOfferQuestionOptionRequest("Option", 0, false)))));

        assertThatThrownBy(() -> jobOfferService.create(RECRUITER_ID, request))
                .isInstanceOf(InvalidJobOfferException.class)
                .hasMessage("Options are only allowed on choice questions.");
    }

    @Test
    void updatePublieeNeTouchePasAuxQuestions() {
        JobOffer offer = publishedOffer();
        stubManagement(offer, RECRUITER_ID, false);

        UpdateJobOfferRequest request = new UpdateJobOfferRequest(
                "Hijacked", null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                List.of(), List.of(), List.of(), List.of(),
                List.of(new JobOfferQuestionRequest("Q?", "text", false, 0, List.of())), null);

        assertThatThrownBy(() -> jobOfferService.update(RECRUITER_ID, OFFER_ID, request))
                .isInstanceOf(InvalidJobOfferStatusException.class);
        verify(jobOfferQuestionRepository, never()).deleteAllByJobOfferId(any());
        verify(jobOfferQuestionRepository, never()).saveAllAndFlush(any());
    }

    @Test
    void duplicateCopieQuestionsEtOptionsAvecDeNouveauxIds() {
        JobOffer source = publishedOffer();
        stubRecruiter(true);
        stubDuplicateSource(source, OTHER_RECRUITER_ID);
        when(jobOfferRepository.save(any(JobOffer.class))).thenAnswer(invocation -> {
            JobOffer copy = invocation.getArgument(0);
            copy.setId(COPY_ID);
            return copy;
        });
        when(jobOfferQuestionRepository.findByJobOfferIdInOrderBySortOrderAscIdAsc(List.of(OFFER_ID)))
                .thenReturn(List.of(JobOfferQuestion.builder()
                        .id(QUESTION_ID).jobOfferId(OFFER_ID).label("Availability?")
                        .questionType(QuestionType.SINGLE_CHOICE).isRequired(true).sortOrder(0)
                        .build()));
        when(jobOfferQuestionOptionRepository.findByQuestionIdInOrderBySortOrderAscIdAsc(List.of(QUESTION_ID)))
                .thenReturn(List.of(JobOfferQuestionOption.builder()
                        .id(OPTION_ID).questionId(QUESTION_ID).label("ASAP").sortOrder(0).preferred(true)
                        .build()));

        jobOfferService.duplicate(OTHER_RECRUITER_ID, OFFER_ID);

        ArgumentCaptor<List<JobOfferQuestion>> questionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(jobOfferQuestionRepository).saveAllAndFlush(questionsCaptor.capture());
        JobOfferQuestion copiedQuestion = questionsCaptor.getValue().get(0);
        assertThat(copiedQuestion.getId()).isNotNull().isNotEqualTo(QUESTION_ID);
        assertThat(copiedQuestion.getJobOfferId()).isEqualTo(COPY_ID);
        assertThat(copiedQuestion.getLabel()).isEqualTo("Availability?");
        assertThat(copiedQuestion.getQuestionType()).isEqualTo(QuestionType.SINGLE_CHOICE);
        assertThat(copiedQuestion.getIsRequired()).isTrue();

        ArgumentCaptor<List<JobOfferQuestionOption>> optionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(jobOfferQuestionOptionRepository).saveAll(optionsCaptor.capture());
        JobOfferQuestionOption copiedOption = optionsCaptor.getValue().get(0);
        assertThat(copiedOption.getId()).isNotNull().isNotEqualTo(OPTION_ID);
        assertThat(copiedOption.getQuestionId()).isEqualTo(copiedQuestion.getId());
        assertThat(copiedOption.getLabel()).isEqualTo("ASAP");
        assertThat(copiedOption.getPreferred()).isTrue();
    }

    private JobOffer draftOffer() {
        return JobOffer.builder()
                .id(OFFER_ID)
                .companyId(COMPANY_ID)
                .recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.DRAFT)
                .title("Backend Engineer")
                .build();
    }

    private JobOffer publishedOffer() {
        return JobOffer.builder()
                .id(OFFER_ID)
                .companyId(COMPANY_ID)
                .recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.PUBLISHED)
                .title("Backend Engineer")
                .publicId("abcdefghijkl")
                .slug("backend-engineer")
                .description("Build APIs")
                .country("FR")
                .validatedAt(LocalDateTime.now().minusDays(2))
                .publishedAt(LocalDateTime.now().minusDays(1))
                .expiresAt(LocalDate.now().minusDays(1))
                .build();
    }

    private void stubDuplicateSource(JobOffer source, UUID duplicatorId) {
        stubMembership(duplicatorId, false);
        when(jobOfferRepository.findByIdAndCompanyIdIn(OFFER_ID, List.of(COMPANY_ID)))
                .thenReturn(Optional.of(source));
    }

    /** saveAll reçoit un Iterable : conversion pour les assertions argThat. */
    private static <T> List<T> asList(Iterable<T> iterable) {
        List<T> list = new ArrayList<>();
        iterable.forEach(list::add);
        return list;
    }

    private void stubManagement(JobOffer offer, UUID managerId, boolean isOwner) {
        stubRecruiter(true);
        CompanyMember membership = CompanyMember.builder()
                .companyId(COMPANY_ID)
                .recruiterId(managerId)
                .isOwner(isOwner)
                .build();
        when(companyMemberRepository.findByRecruiterId(managerId)).thenReturn(List.of(membership));
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, managerId))
                .thenReturn(Optional.of(membership));
        when(jobOfferRepository.findByIdAndCompanyIdIn(OFFER_ID, List.of(COMPANY_ID)))
                .thenReturn(Optional.of(offer));
        // Les transitions passent par findByIdForUpdate (lock en tête).
        when(jobOfferRepository.findByIdForUpdate(OFFER_ID)).thenReturn(Optional.of(offer));
    }

    @Test
    void slugifyProduitUnSlugAsciiCourt() {
        assertThat(JobOfferService.slugify("Senior Backend Engineer"))
                .isEqualTo("senior-backend-engineer");
        assertThat(JobOfferService.slugify("  Développeur C++ / DevOps!  "))
                .isEqualTo("developpeur-c-devops");
        assertThat(JobOfferService.slugify("---")).isEmpty();
        assertThat(JobOfferService.slugify(null)).isEmpty();
        assertThat(JobOfferService.slugify("a".repeat(200))).hasSizeLessThanOrEqualTo(120);
    }

    private void stubRecruiter(boolean exists) {
        when(recruiterRepository.existsById(RECRUITER_ID)).thenReturn(exists);
        when(recruiterRepository.existsById(OTHER_RECRUITER_ID)).thenReturn(exists);
    }

    private void stubMembership(UUID recruiterId, boolean isOwner) {
        CompanyMember membership = CompanyMember.builder()
                .companyId(COMPANY_ID)
                .recruiterId(recruiterId)
                .isOwner(isOwner)
                .build();
        when(companyMemberRepository.findByRecruiterId(recruiterId)).thenReturn(List.of(membership));
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, recruiterId))
                .thenReturn(Optional.of(membership));
    }

    private CreateJobOfferRequest createRequest() {
        return new CreateJobOfferRequest(
                COMPANY_ID, "Backend Engineer", "Build APIs", "mid", 3, "Paris", "FR",
                CONTRACT_TYPE_ID, null, null, null,
                new BigDecimal("50000"), new BigDecimal("70000"), "EUR", "year",
                List.of(new com.linqorbit.joboffer.dto.JobOfferSkillRequest(SKILL_ID, "mandatory", 3, 2)),
                List.of(), List.of(), List.of(), List.of(), null);
    }

    private UpdateJobOfferRequest updateRequest(String title) {
        return new UpdateJobOfferRequest(
                title, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                List.of(), List.of(), List.of(), List.of(), List.of(), null);
    }

    private CreateJobOfferRequest createRequestWithQuestions() {
        return requestWithQuestions(List.of(
                new JobOfferQuestionRequest("How many years with Java?", "number", false, 0, List.of()),
                new JobOfferQuestionRequest("Where do you want to work?", "single_choice", true, 1, List.of(
                        new JobOfferQuestionOptionRequest("On-site", 0, false),
                        new JobOfferQuestionOptionRequest("Remote", 1, true)))));
    }

    private CreateJobOfferRequest requestWithQuestions(List<JobOfferQuestionRequest> questions) {
        return new CreateJobOfferRequest(
                COMPANY_ID, "Backend Engineer", "Build APIs", "mid", 3, "Paris", "FR",
                CONTRACT_TYPE_ID, null, null, null,
                new BigDecimal("50000"), new BigDecimal("70000"), "EUR", "year",
                List.of(new com.linqorbit.joboffer.dto.JobOfferSkillRequest(SKILL_ID, "mandatory", 3, 2)),
                List.of(), List.of(), List.of(), questions, null);
    }
}
