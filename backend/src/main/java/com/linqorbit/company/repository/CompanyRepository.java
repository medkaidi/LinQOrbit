package com.linqorbit.company.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.company.entity.Company;

public interface CompanyRepository extends JpaRepository<Company, UUID> {
}
