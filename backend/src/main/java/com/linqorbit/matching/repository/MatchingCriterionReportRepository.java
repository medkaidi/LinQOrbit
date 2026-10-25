package com.linqorbit.matching.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.linqorbit.matching.entity.MatchingCriterionReport;

/**
 * Signalements internes d'une évaluation IA (T-86, D66) : par résultat et
 * auteur (détail recruteur — l'auteur voit ses propres signalements) et
 * lecture globale paginée (console admin).
 */
public interface MatchingCriterionReportRepository extends JpaRepository<MatchingCriterionReport, UUID> {

    boolean existsByMatchingResultIdAndCriterionKeyAndAuthorUserId(UUID matchingResultId, String criterionKey,
            UUID authorUserId);

    List<MatchingCriterionReport> findByMatchingResultIdAndAuthorUserIdOrderByCriterionKeyAsc(
            UUID matchingResultId, UUID authorUserId);

    Page<MatchingCriterionReport> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    /**
     * Tableau de bord admin : signalements que cet admin peut relire — dont il n'est pas l'auteur et
     * sur lesquels il n'a pas encore d'avis (le {@code canReview} du dossier).
     */
    @Query("""
            select count(r) from MatchingCriterionReport r
            where r.authorUserId <> :adminUserId
              and not exists (select 1 from MatchingCriterionReportReview v
                              where v.reportId = r.id and v.reviewerUserId = :adminUserId)""")
    long countAwaitingReview(@Param("adminUserId") UUID adminUserId);
}
