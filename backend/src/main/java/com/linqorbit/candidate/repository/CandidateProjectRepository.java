package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.CandidateProject;

public interface CandidateProjectRepository extends JpaRepository<CandidateProject, UUID> {

    List<CandidateProject> findByCandidateIdOrderBySortOrderAsc(UUID candidateId);

    @Modifying
    @Query("delete from CandidateProject p where p.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
