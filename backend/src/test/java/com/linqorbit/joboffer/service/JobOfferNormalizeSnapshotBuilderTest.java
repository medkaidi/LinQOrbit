package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillType;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.OfferSnapshot;
import com.linqorbit.joboffer.entity.ContractType;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.RequirementType;
import com.linqorbit.joboffer.entity.Seniority;
import com.linqorbit.joboffer.repository.ContractTypeRepository;
import com.linqorbit.joboffer.repository.EmploymentTypeRepository;
import com.linqorbit.joboffer.repository.JobOfferDegreeRepository;
import com.linqorbit.joboffer.repository.JobOfferLanguageRepository;
import com.linqorbit.joboffer.repository.JobOfferSkillRepository;
import com.linqorbit.joboffer.repository.JobOfferStudyFieldRepository;
import com.linqorbit.joboffer.repository.WorkModeRepository;

/**
 * Snapshot d'offre pour le service IA : libellés résolus (jamais d'UUID),
 * description HTML strippée en texte brut, requirementType transmis tel quel.
 */
class JobOfferNormalizeSnapshotBuilderTest {

    private static final UUID OFFER_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");
    private static final UUID COMPANY_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID SKILL_ID = UUID.fromString("a0000000-0000-4000-8000-000000000001");
    private static final UUID LANGUAGE_ID = UUID.fromString("b0000000-0000-4000-8000-000000000002");
    private static final UUID CONTRACT_TYPE_ID = UUID.fromString("b0000000-0000-4000-8000-000000000001");

    private JobOfferSkillRepository jobOfferSkillRepository;
    private JobOfferLanguageRepository jobOfferLanguageRepository;
    private JobOfferNormalizeSnapshotBuilder builder;

    @BeforeEach
    void setUp() {
        jobOfferSkillRepository = mock(JobOfferSkillRepository.class);
        jobOfferLanguageRepository = mock(JobOfferLanguageRepository.class);
        JobOfferDegreeRepository jobOfferDegreeRepository = mock(JobOfferDegreeRepository.class);
        JobOfferStudyFieldRepository jobOfferStudyFieldRepository = mock(JobOfferStudyFieldRepository.class);
        CompanyRepository companyRepository = mock(CompanyRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        LanguageRepository languageRepository = mock(LanguageRepository.class);
        DegreeRepository degreeRepository = mock(DegreeRepository.class);
        StudyFieldRepository studyFieldRepository = mock(StudyFieldRepository.class);
        ContractTypeRepository contractTypeRepository = mock(ContractTypeRepository.class);
        EmploymentTypeRepository employmentTypeRepository = mock(EmploymentTypeRepository.class);
        WorkModeRepository workModeRepository = mock(WorkModeRepository.class);
        builder = new JobOfferNormalizeSnapshotBuilder(jobOfferSkillRepository,
                jobOfferLanguageRepository, jobOfferDegreeRepository, jobOfferStudyFieldRepository,
                companyRepository, skillRepository, languageRepository, degreeRepository,
                studyFieldRepository, contractTypeRepository, employmentTypeRepository,
                workModeRepository);

        when(jobOfferSkillRepository.findByJobOfferIdIn(List.of(OFFER_ID))).thenReturn(List.of(
                JobOfferSkill.builder().jobOfferId(OFFER_ID).skillId(SKILL_ID)
                        .requirementType(RequirementType.MANDATORY).weight(5).yearsExperience(3)
                        .build()));
        when(skillRepository.findAllById(anyList())).thenReturn(List.of(
                Skill.builder().id(SKILL_ID).name("Java").skillType(SkillType.TECH)
                        .category("Software").build()));
        when(jobOfferLanguageRepository.findByJobOfferIdIn(List.of(OFFER_ID))).thenReturn(List.of(
                JobOfferLanguage.builder().jobOfferId(OFFER_ID).languageId(LANGUAGE_ID)
                        .level("B2").isRequired(true).build()));
        when(languageRepository.findAllById(anyList())).thenReturn(List.of(
                Language.builder().id(LANGUAGE_ID).symbol("GB").name("English").build()));
        when(jobOfferDegreeRepository.findByJobOfferIdIn(List.of(OFFER_ID))).thenReturn(List.of());
        when(jobOfferStudyFieldRepository.findByJobOfferIdIn(List.of(OFFER_ID))).thenReturn(List.of());
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(
                Company.builder().id(COMPANY_ID).name("Acme").description("We build payments.").build()));
        when(contractTypeRepository.findById(CONTRACT_TYPE_ID)).thenReturn(Optional.of(
                ContractType.builder().id(CONTRACT_TYPE_ID).label("Permanent").build()));
    }

    private JobOffer offer(String description) {
        return JobOffer.builder().id(OFFER_ID).companyId(COMPANY_ID).title("Backend Engineer")
                .description(description).seniority(Seniority.SENIOR).requiredExpYear(3)
                .city("Paris").country("FR").contractTypeId(CONTRACT_TYPE_ID).build();
    }

    @Test
    void buildResoutLesLibellesEtStripLeHtml() {
        OfferSnapshot snapshot = builder.build(
                offer("<p>Own the <strong>public API</strong>.</p><ul><li>On-call rotation</li></ul>"));

        assertThat(snapshot.title()).isEqualTo("Backend Engineer");
        assertThat(snapshot.description()).isEqualTo("Own the public API. On-call rotation");
        assertThat(snapshot.seniority()).isEqualTo("senior");
        assertThat(snapshot.contractTypeLabel()).isEqualTo("Permanent");
        assertThat(snapshot.employmentTypeLabel()).isNull();
        assertThat(snapshot.company().name()).isEqualTo("Acme");
        assertThat(snapshot.company().description()).isEqualTo("We build payments.");
        assertThat(snapshot.skills()).hasSize(1);
        assertThat(snapshot.skills().get(0).name()).isEqualTo("Java");
        assertThat(snapshot.skills().get(0).requirementType()).isEqualTo("mandatory");
        assertThat(snapshot.skills().get(0).weight()).isEqualTo(5);
        assertThat(snapshot.skills().get(0).yearsExperience()).isEqualTo(3);
        assertThat(snapshot.languages()).hasSize(1);
        assertThat(snapshot.languages().get(0).name()).isEqualTo("English");
        assertThat(snapshot.languages().get(0).isRequired()).isTrue();
    }

    @Test
    void buildDonneNullQuandLaDescriptionEstVideApresStrip() {
        OfferSnapshot snapshot = builder.build(offer("<p>   </p>"));

        assertThat(snapshot.description()).isNull();
    }

    @Test
    void buildDonneNullQuandLCompanyEstIntrouvable() {
        JobOffer orphan = JobOffer.builder().id(OFFER_ID)
                .companyId(UUID.fromString("99999999-9999-4999-8999-999999999999"))
                .title("Dev").build();

        OfferSnapshot snapshot = builder.build(orphan);

        assertThat(snapshot.company().name()).isNull();
        assertThat(snapshot.company().description()).isNull();
    }
}
