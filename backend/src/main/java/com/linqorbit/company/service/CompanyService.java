package com.linqorbit.company.service;

import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

/**
 * Companies et appartenances (D11–D12) : toute opération exige d'abord une
 * ligne {@code recruiters} (sinon 404 recruteur, onboarding D16), puis
 * résout l'appartenance du compte — inconnu ou non-membre = même 404 (pas de
 * fuite d'existence), membre non-owner sur une action owner = 403.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final CompanyMemberRepository companyMemberRepository;
    private final RecruiterRepository recruiterRepository;
    private final CompanyMapper companyMapper;

    @Transactional
    public CompanyResponse create(UUID userId, CreateCompanyRequest request) {
        log.info("Company creation requested : userId={}, name={}", userId, request.name().trim());
        requireRecruiter(userId);
        Company company = companyRepository.save(Company.builder()
                .name(request.name().trim())
                .description(trimToNull(request.description()))
                .build());
        companyMemberRepository.save(CompanyMember.owner(company.getId(), userId));
        log.info("Company created : companyId={}, ownerUserId={}", company.getId(), userId);
        return companyMapper.toCompanyResponse(company, true);
    }

    @Transactional(readOnly = true)
    public List<CompanyResponse> listMine(UUID userId) {
        requireRecruiter(userId);
        List<CompanyMember> memberships = companyMemberRepository.findByRecruiterId(userId);
        List<Company> companies = companyRepository.findAllById(
                memberships.stream().map(CompanyMember::getCompanyId).toList());
        return companies.stream()
                .map(company -> companyMapper.toCompanyResponse(company, isOwner(memberships, company.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public CompanyResponse get(UUID userId, UUID companyId) {
        requireRecruiter(userId);
        CompanyMember membership = companyMemberRepository.findByCompanyIdAndRecruiterId(companyId, userId)
                .orElseThrow(CompanyNotFoundException::new);
        Company company = companyRepository.findById(companyId).orElseThrow(CompanyNotFoundException::new);
        return companyMapper.toCompanyResponse(company, Boolean.TRUE.equals(membership.getIsOwner()));
    }

    @Transactional
    public void update(UUID userId, UUID companyId, UpdateCompanyRequest request) {
        log.info("Company update requested : userId={}, companyId={}", userId, companyId);
        requireRecruiter(userId);
        CompanyMember membership = companyMemberRepository.findByCompanyIdAndRecruiterId(companyId, userId)
                .orElseThrow(CompanyNotFoundException::new);
        if (!Boolean.TRUE.equals(membership.getIsOwner())) {
            log.warn("Company update rejected : not owner, userId={}, companyId={}", userId, companyId);
            throw new CompanyAccessDeniedException();
        }
        Company company = companyRepository.findById(companyId).orElseThrow(CompanyNotFoundException::new);
        if (request.name() != null && !request.name().trim().isEmpty()) {
            company.setName(request.name().trim());
        }
        if (request.description() != null) {
            company.setDescription(trimToNull(request.description()));
        }
        companyRepository.save(company);
        log.info("Company updated : companyId={}", companyId);
    }

    private void requireRecruiter(UUID userId) {
        if (!recruiterRepository.existsById(userId)) {
            log.warn("Company operation rejected : no recruiter profile, userId={}", userId);
            throw new RecruiterNotFoundException();
        }
    }

    private static boolean isOwner(List<CompanyMember> memberships, UUID companyId) {
        return memberships.stream()
                .anyMatch(membership -> membership.getCompanyId().equals(companyId)
                        && Boolean.TRUE.equals(membership.getIsOwner()));
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
