package com.linqorbit.joboffer.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.WorkMode;

public interface WorkModeRepository extends JpaRepository<WorkMode, UUID> {
}
