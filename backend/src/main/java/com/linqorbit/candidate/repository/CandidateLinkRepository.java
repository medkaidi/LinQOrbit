package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.CandidateLink;

public interface CandidateLinkRepository extends JpaRepository<CandidateLink, UUID> {

    List<CandidateLink> findByCandidateIdOrderBySortOrderAsc(UUID candidateId);

    @Modifying
    @Query("delete from CandidateLink cl where cl.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
