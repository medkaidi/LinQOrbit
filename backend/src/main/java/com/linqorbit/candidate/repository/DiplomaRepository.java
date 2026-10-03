package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.candidate.entity.Diploma;

public interface DiplomaRepository extends JpaRepository<Diploma, UUID> {

    @Query("""
            select d from Diploma d
                left join fetch d.degree
                left join fetch d.studyField
            where d.candidate.id = :candidateId
            order by d.sortOrder""")
    List<Diploma> findByCandidateId(UUID candidateId);

    @Modifying
    @Query("delete from Diploma d where d.candidate.id = :candidateId")
    void deleteAllByCandidateId(UUID candidateId);
}
