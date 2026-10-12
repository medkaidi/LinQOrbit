package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.repository.CompanyMemberRepository;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
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
 * Logique métier des offres (D12–D14) : permissions coarse (membre = lecture +
 * création, owner ou créateur = gestion), transitions D13, vocabulaires D14,
 * fourchette salariale.
 */
class JobOfferServiceTest {

    private static final UUID RECRUITER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID OTHER_RECRUITER_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID COMPANY_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID SKILL_ID = UUID.fromString("a0000000-0000-4000-8000-000000000001");
    private static final UUID CONTRACT_TYPE_ID = UUID.fromString("b0000000-0000-4000-8000-000000000001");

    private JobOfferRepository jobOfferRepository;
    private JobOfferSkillRepository jobOfferSkillRepository;
    private JobOfferLanguageRepository jobOfferLanguageRepository;
    private JobOfferDegreeRepository jobOfferDegreeRepository;
    private JobOfferStudyFieldRepository jobOfferStudyFieldRepository;
    private CompanyMemberRepository companyMemberRepository;
    private RecruiterRepository recruiterRepository;
    private SkillRepository skillRepository;
    private LanguageRepository languageRepository;
    private DegreeRepository degreeRepository;
    private StudyFieldRepository studyFieldRepository;
    private ContractTypeRepository contractTypeRepository;
    private EmploymentTypeRepository employmentTypeRepository;
    private WorkModeRepository workModeRepository;
    private JobOfferService jobOfferService;

    @BeforeEach
    void setUp() {
        jobOfferRepository = mock(JobOfferRepository.class);
        jobOfferSkillRepository = mock(JobOfferSkillRepository.class);
        jobOfferLanguageRepository = mock(JobOfferLanguageRepository.class);
        jobOfferDegreeRepository = mock(JobOfferDegreeRepository.class);
        jobOfferStudyFieldRepository = mock(JobOfferStudyFieldRepository.class);
        companyMemberRepository = mock(CompanyMemberRepository.class);
        recruiterRepository = mock(RecruiterRepository.class);
        skillRepository = mock(SkillRepository.class);
        languageRepository = mock(LanguageRepository.class);
        degreeRepository = mock(DegreeRepository.class);
        studyFieldRepository = mock(StudyFieldRepository.class);
        contractTypeRepository = mock(ContractTypeRepository.class);
        employmentTypeRepository = mock(EmploymentTypeRepository.class);
        workModeRepository = mock(WorkModeRepository.class);
        jobOfferService = new JobOfferService(
                jobOfferRepository, jobOfferSkillRepository, jobOfferLanguageRepository,
                jobOfferDegreeRepository, jobOfferStudyFieldRepository, companyMemberRepository,
                recruiterRepository, skillRepository, languageRepository, degreeRepository,
                studyFieldRepository, contractTypeRepository, employmentTypeRepository, workModeRepository);

        lenient().when(jobOfferSkillRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferLanguageRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferDegreeRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
        lenient().when(jobOfferStudyFieldRepository.findByJobOfferIdIn(any())).thenReturn(List.of());
    }

    @Test
    void createCreeUneOffreDraftEnMembre() {
        stubRecruiter(true);
        stubMembership(RECRUITER_ID, true);
        when(skillRepository.existsById(SKILL_ID)).thenReturn(true);
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
                List.of(), List.of(), List.of(), List.of());

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
    void validatePasseEnValidatedEtPoseValidatedAt() {
        JobOffer offer = draftOffer();
        stubManagement(offer, RECRUITER_ID, false);

        jobOfferService.validate(RECRUITER_ID, OFFER_ID);

        assertThat(offer.getStatus()).isEqualTo(JobOfferStatus.VALIDATED);
        assertThat(offer.getValidatedAt()).isNotNull();
        assertThat(offer.getUpdatedAt()).isEqualTo(offer.getValidatedAt());
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

    private JobOffer draftOffer() {
        return JobOffer.builder()
                .id(OFFER_ID)
                .companyId(COMPANY_ID)
                .recruiterId(RECRUITER_ID)
                .status(JobOfferStatus.DRAFT)
                .title("Backend Engineer")
                .build();
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
                List.of(), List.of(), List.of());
    }

    private UpdateJobOfferRequest updateRequest(String title) {
        return new UpdateJobOfferRequest(
                title, null, null, null, null, null,
                null, null, null, null,
                null, null, null, null,
                List.of(), List.of(), List.of(), List.of());
    }
}
