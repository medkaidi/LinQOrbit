package com.linqorbit.matching.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.matching.entity.MatchingResult;

/**
 * Accès aux résultats versionnés : dernière version d'un matching (le
 * résultat courant), version maximale (calculée sous verrou de la ligne
 * matching) et écriture du JSON par le worker (résultat immuable sinon).
 */
public interface MatchingResultRepository extends JpaRepository<MatchingResult, UUID> {

    Optional<MatchingResult> findFirstByMatchingIdOrderByVersionDesc(UUID matchingId);

    @Query("select max(r.version) from MatchingResult r where r.matchingId = :matchingId")
    Integer findMaxVersionByMatchingId(UUID matchingId);

    @Modifying(clearAutomatically = true)
    @Query("update MatchingResult r set r.result = :result where r.id = :id")
    int setResult(UUID id, String result);
}
