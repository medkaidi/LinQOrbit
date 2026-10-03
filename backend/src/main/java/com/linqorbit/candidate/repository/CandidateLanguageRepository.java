package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.CandidateLanguage;

public interface CandidateLanguageRepository extends JpaRepository<CandidateLanguage, UUID> {

    @Query("""
            select cl from CandidateLanguage cl
                join fetch cl.language
            where cl.candidate.id = :candidateId
            order by cl.language.name""")
    List<CandidateLanguage> findByCandidateId(UUID candidateId);

    @Modifying
    @Query("delete from CandidateLanguage cl where cl.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
