package com.linqorbit.matching.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.matching.entity.Clarification;
import com.linqorbit.matching.entity.ClarificationStatus;

/**
 * Accès aux clarifications d'un matching : la question ouverte (au plus une,
 * index partiel V22), l'historique dans l'ordre d'ajout (rejoué à chaque
 * appel IA, D58) et le compte total qui consomme le plafond de l'offre.
 */
public interface ClarificationRepository extends JpaRepository<Clarification, UUID> {

    Optional<Clarification> findByMatchingIdAndStatus(UUID matchingId, ClarificationStatus status);

    Optional<Clarification> findByIdAndMatchingId(UUID id, UUID matchingId);

    /** Historique dans l'ordre d'ajout, plus ancienne d'abord. */
    List<Clarification> findByMatchingIdAndStatusInOrderByCreatedAtAscIdAsc(UUID matchingId,
            List<ClarificationStatus> statuses);

    /** Questions déjà posées (skips compris) : chacune consomme un cran du plafond. */
    long countByMatchingId(UUID matchingId);

    /** Fin d'évaluation : la question ouverte passe SKIPPED (0 ou 1 ligne). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Clarification c set c.status = :skipped where c.matchingId = :matchingId and c.status = :open")
    int closeOpen(UUID matchingId, ClarificationStatus open, ClarificationStatus skipped);
}
