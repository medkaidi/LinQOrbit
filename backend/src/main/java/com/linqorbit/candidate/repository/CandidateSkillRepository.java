package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.CandidateSkill;

public interface CandidateSkillRepository extends JpaRepository<CandidateSkill, UUID> {

    @Query("""
            select cs from CandidateSkill cs
                join fetch cs.skill
            where cs.candidate.id = :candidateId
            order by cs.skill.name""")
    List<CandidateSkill> findByCandidateId(UUID candidateId);

    @Modifying
    @Query("delete from CandidateSkill cs where cs.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
