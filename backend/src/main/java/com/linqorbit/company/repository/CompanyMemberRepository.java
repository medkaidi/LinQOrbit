package com.linqorbit.company.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.entity.CompanyMemberId;

public interface CompanyMemberRepository extends JpaRepository<CompanyMember, CompanyMemberId> {

    List<CompanyMember> findByRecruiterId(UUID recruiterId);

    Optional<CompanyMember> findByCompanyIdAndRecruiterId(UUID companyId, UUID recruiterId);

    boolean existsByRecruiterId(UUID recruiterId);
}
