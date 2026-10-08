package com.linqorbit.candidate;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface CandidateRepository extends JpaRepository<Candidate, UUID> {

    /**
     * Lecture verrouillée (SELECT … FOR UPDATE) : sérialise les tx de
     * validation de normalisation d'un même candidat (numérotation des
     * versions, dirty-check, supersede) sans colonne de version optimiste.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Candidate c where c.id = :id")
    Optional<Candidate> findByIdForUpdate(UUID id);
}
