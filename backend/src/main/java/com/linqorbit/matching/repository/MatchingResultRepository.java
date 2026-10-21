package com.linqorbit.matching.repository;

import java.util.List;
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

    /** Dernier résultat terminé (avec contenu) : scores affichés, cible des contestations (T-63). */
    Optional<MatchingResult> findFirstByMatchingIdAndResultIsNotNullOrderByVersionDesc(UUID matchingId);

    /** Derniers résultats d'un lot de matchings, pour la liste recruteur (T-66) sans N+1. */
    List<MatchingResult> findByMatchingIdInAndResultIsNotNullOrderByMatchingIdAscVersionDesc(
            List<UUID> matchingIds);

    /** Résultat terminé qui précède une version : évaluations précédentes rejouées à l'agent (T-62). */
    Optional<MatchingResult> findFirstByMatchingIdAndResultIsNotNullAndVersionLessThanOrderByVersionDesc(
            UUID matchingId, Integer version);

    @Query("select max(r.version) from MatchingResult r where r.matchingId = :matchingId")
    Integer findMaxVersionByMatchingId(UUID matchingId);

    @Modifying(clearAutomatically = true)
    @Query("update MatchingResult r set r.result = :result where r.id = :id")
    int setResult(UUID id, String result);
}
