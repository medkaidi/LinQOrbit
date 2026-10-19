package com.linqorbit.matching.repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import com.linqorbit.matching.entity.Matching;

/**
 * Accès aux matchings : recherche par identité (couple + version de fiche
 * candidat, D50) et verrou pessimiste de la ligne pour sérialiser la
 * création des versions de résultat (D51).
 */
public interface MatchingRepository extends JpaRepository<Matching, UUID> {

    Optional<Matching> findByCandidateIdAndJobOfferIdAndCandidateNormalizedProfileId(UUID candidateId,
            UUID jobOfferId, UUID candidateNormalizedProfileId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Matching m where m.id = :id")
    Optional<Matching> findByIdForUpdate(UUID id);

    /** Clôt l'évaluation (D52) : idempotent, la première date est conservée. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Matching m set m.assessmentFinishedAt = :now, m.updatedAt = :now
            where m.id = :id and m.assessmentFinishedAt is null""")
    int finishAssessment(UUID id, LocalDateTime now);
}
