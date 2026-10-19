package com.linqorbit.matching.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.matching.entity.MatchingCriterionFeedback;

/**
 * Contestations du candidat : par résultat (lecture et remplacement complet)
 * et par matching (présence, vue recruteur T-66).
 */
public interface MatchingCriterionFeedbackRepository extends JpaRepository<MatchingCriterionFeedback, UUID> {

    List<MatchingCriterionFeedback> findByMatchingResultIdOrderByCriterionKeyAsc(UUID matchingResultId);

    List<MatchingCriterionFeedback> findByMatchingIdOrderByCriterionKeyAsc(UUID matchingId);

    boolean existsByMatchingId(UUID matchingId);
}
