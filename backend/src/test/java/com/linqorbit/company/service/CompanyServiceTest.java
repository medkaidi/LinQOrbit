package com.linqorbit.company.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.linqorbit.company.dto.CompanyResponse;
import com.linqorbit.company.dto.CreateCompanyRequest;
import com.linqorbit.company.dto.UpdateCompanyRequest;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.exception.CompanyAccessDeniedException;
import com.linqorbit.company.exception.CompanyNotFoundException;
import com.linqorbit.company.mapper.CompanyMapper;
import com.linqorbit.company.repository.CompanyMemberRepository;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.repository.RecruiterRepository;

class CompanyServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID COMPANY_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");

    private CompanyRepository companyRepository;
    private CompanyMemberRepository companyMemberRepository;
    private RecruiterRepository recruiterRepository;
    private CompanyMapper companyMapper;
    private CompanyService companyService;

    @BeforeEach
    void setUp() {
        companyRepository = mock(CompanyRepository.class);
        companyMemberRepository = mock(CompanyMemberRepository.class);
        recruiterRepository = mock(RecruiterRepository.class);
        companyMapper = mock(CompanyMapper.class);
        companyService = new CompanyService(companyRepository, companyMemberRepository, recruiterRepository,
                companyMapper);
    }

    @Test
    void createCreeLaCompanyEtLeOwner() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        Company saved = Company.builder().id(COMPANY_ID).name("Acme").build();
        when(companyRepository.save(any(Company.class))).thenReturn(saved);
        when(companyMapper.toCompanyResponse(saved, true))
                .thenReturn(new CompanyResponse(COMPANY_ID, "Acme", null, true));

        CompanyResponse response = companyService.create(USER_ID, new CreateCompanyRequest("  Acme  ", null));

        assertThat(response.isOwner()).isTrue();
        ArgumentCaptor<CompanyMember> captor = ArgumentCaptor.forClass(CompanyMember.class);
        verify(companyMemberRepository).save(captor.capture());
        assertThat(captor.getValue().getCompanyId()).isEqualTo(COMPANY_ID);
        assertThat(captor.getValue().getRecruiterId()).isEqualTo(USER_ID);
        assertThat(captor.getValue().getIsOwner()).isTrue();
    }

    @Test
    void createRejetteUnCompteSansProfilRecruteur() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(false);

        assertThatThrownBy(() -> companyService.create(USER_ID, new CreateCompanyRequest("Acme", null)))
                .isInstanceOf(RecruiterNotFoundException.class);
    }

    @Test
    void listMineMarqueLeRoleOwner() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByRecruiterId(USER_ID)).thenReturn(List.of(
                CompanyMember.owner(COMPANY_ID, USER_ID)));
        Company company = Company.builder().id(COMPANY_ID).name("Acme").build();
        when(companyRepository.findAllById(List.of(COMPANY_ID))).thenReturn(List.of(company));
        when(companyMapper.toCompanyResponse(company, true))
                .thenReturn(new CompanyResponse(COMPANY_ID, "Acme", null, true));

        List<CompanyResponse> companies = companyService.listMine(USER_ID);

        assertThat(companies).hasSize(1);
        assertThat(companies.get(0).isOwner()).isTrue();
    }

    @Test
    void getRenvoieLaCompanyDuMembre() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, USER_ID))
                .thenReturn(Optional.of(CompanyMember.owner(COMPANY_ID, USER_ID)));
        Company company = Company.builder().id(COMPANY_ID).name("Acme").build();
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(company));
        when(companyMapper.toCompanyResponse(company, true))
                .thenReturn(new CompanyResponse(COMPANY_ID, "Acme", null, true));

        CompanyResponse response = companyService.get(USER_ID, COMPANY_ID);

        assertThat(response.name()).isEqualTo("Acme");
    }

    @Test
    void getRejetteUnNonMembre() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> companyService.get(USER_ID, COMPANY_ID))
                .isInstanceOf(CompanyNotFoundException.class);
    }

    @Test
    void updateRejetteUnMembreNonOwner() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, USER_ID))
                .thenReturn(Optional.of(CompanyMember.builder()
                        .companyId(COMPANY_ID).recruiterId(USER_ID).isOwner(false).build()));

        assertThatThrownBy(() -> companyService.update(USER_ID, COMPANY_ID, new UpdateCompanyRequest("X", null)))
                .isInstanceOf(CompanyAccessDeniedException.class);
    }

    @Test
    void updateOwnerEcritNameEtDescription() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, USER_ID))
                .thenReturn(Optional.of(CompanyMember.owner(COMPANY_ID, USER_ID)));
        Company company = Company.builder().id(COMPANY_ID).name("Old").build();
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(company));
        when(companyRepository.save(any(Company.class))).thenReturn(company);

        companyService.update(USER_ID, COMPANY_ID, new UpdateCompanyRequest("  New  ", "  Desc  "));

        assertThat(company.getName()).isEqualTo("New");
        assertThat(company.getDescription()).isEqualTo("Desc");
    }

    @Test
    void updateOwnerIgnoreLeNameVideMaisEffaceLaDescription() {
        when(recruiterRepository.existsById(USER_ID)).thenReturn(true);
        when(companyMemberRepository.findByCompanyIdAndRecruiterId(COMPANY_ID, USER_ID))
                .thenReturn(Optional.of(CompanyMember.owner(COMPANY_ID, USER_ID)));
        Company company = Company.builder().id(COMPANY_ID).name("Keep").description("Desc").build();
        when(companyRepository.findById(COMPANY_ID)).thenReturn(Optional.of(company));
        when(companyRepository.save(any(Company.class))).thenReturn(company);

        companyService.update(USER_ID, COMPANY_ID, new UpdateCompanyRequest("", ""));

        assertThat(company.getName()).isEqualTo("Keep");
        assertThat(company.getDescription()).isNull();
    }
}
