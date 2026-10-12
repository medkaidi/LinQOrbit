package com.linqorbit.joboffer.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.ContractType;

public interface ContractTypeRepository extends JpaRepository<ContractType, UUID> {
}
