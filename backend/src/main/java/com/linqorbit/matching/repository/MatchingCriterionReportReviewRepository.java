package com.linqorbit.matching.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.matching.entity.MatchingCriterionReportReview;

/**
 * Revues internes des signalements d'évaluation IA (T-96, D77/D78) : lecture
 * de l'avis d'un reviewer donné et contrôle d'unicité (report, reviewer).
 * Aucun update/delete n'est exposé par le service.
 */
public interface MatchingCriterionReportReviewRepository
        extends JpaRepository<MatchingCriterionReportReview, UUID> {

    Optional<MatchingCriterionReportReview> findByReportIdAndReviewerUserId(UUID reportId,
            UUID reviewerUserId);

    /**
     * Avis du reviewer courant sur une page de signalements (T-99) — lecture
     * en un seul lot, jamais une requête par carte.
     */
    List<MatchingCriterionReportReview> findByReviewerUserIdAndReportIdIn(UUID reviewerUserId,
            List<UUID> reportIds);

    boolean existsByReportIdAndReviewerUserId(UUID reportId, UUID reviewerUserId);
}
