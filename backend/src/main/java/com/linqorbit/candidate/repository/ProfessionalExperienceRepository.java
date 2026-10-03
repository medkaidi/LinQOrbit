package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.ProfessionalExperience;

public interface ProfessionalExperienceRepository extends JpaRepository<ProfessionalExperience, UUID> {

    List<ProfessionalExperience> findByCandidateIdOrderBySortOrderAsc(UUID candidateId);

    @Modifying
    @Query("delete from ProfessionalExperience e where e.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
