package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.SkillSuggestion;

public interface SkillSuggestionRepository extends JpaRepository<SkillSuggestion, UUID> {

    List<SkillSuggestion> findByCandidateId(UUID candidateId);
}
