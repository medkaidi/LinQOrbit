package com.linqorbit.matching.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.matching.entity.MatchingCriterionFeedback;

/**
 * Contestations du candidat : lectures strictement par résultat (le dernier
 * résultat terminé est résolu par l'appelant). Aucune méthode par matching :
 * une contestation d'un ancien résultat ne doit jamais être relue.
 */
public interface MatchingCriterionFeedbackRepository extends JpaRepository<MatchingCriterionFeedback, UUID> {

    List<MatchingCriterionFeedback> findByMatchingResultIdOrderByCriterionKeyAsc(UUID matchingResultId);

    /** Contestations d'un lot de résultats (dernier résultat de chaque matching). */
    List<MatchingCriterionFeedback> findByMatchingResultIdInOrderByMatchingResultIdAscCriterionKeyAsc(
            List<UUID> matchingResultIds);

    /**
     * Présence d'une contestation sur un résultat précis. Les lectures
     * latest-only passent par cette méthode : une contestation d'un ancien
     * résultat n'est jamais considérée comme courante.
     */
    boolean existsByMatchingResultId(UUID matchingResultId);
}
