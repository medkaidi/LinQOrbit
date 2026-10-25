package com.linqorbit.application.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.linqorbit.application.entity.Application;
import com.linqorbit.application.entity.ApplicationStatus;

/**
 * Accès aux candidatures : lecture « mes candidatures » (plus récentes
 * d'abord, ordre stable), contrôle propriétaire et garde du couple
 * (candidat, offre) — une candidature par couple.
 */
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByCandidateIdOrderByCreatedAtDescIdDesc(UUID candidateId);

    /** Les plus récentes d'abord (même ordre que la liste complète), bornées par la page — sans {@code count}. */
    List<Application> findByCandidateIdOrderByCreatedAtDescIdDesc(UUID candidateId, Pageable pageable);

    /**
     * Compteurs du tableau de bord : un seul GROUP BY filtré sur le candidat (l'index de
     * {@code uq_application_candidate_job_offer} a {@code candidate_id} en tête), jamais un
     * COUNT par statut. Un statut absent du résultat vaut 0.
     */
    @Query(value = """
            SELECT a.status, COUNT(*)
            FROM application a
            WHERE a.candidate_id = :candidateId
            GROUP BY a.status
            """, nativeQuery = true)
    List<Object[]> countByStatusForCandidate(@Param("candidateId") UUID candidateId);

    Optional<Application> findByIdAndCandidateId(UUID id, UUID candidateId);

    Optional<Application> findByIdAndJobOfferId(UUID id, UUID jobOfferId);

    /** Verrou candidat : sérialise submit / withdraw sur la même candidature. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Application a where a.id = :id and a.candidateId = :candidateId")
    Optional<Application> findByIdAndCandidateIdForUpdate(@Param("id") UUID id,
            @Param("candidateId") UUID candidateId);

    /** Verrou recruteur : sérialise les décisions concurrentes sur la même candidature. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Application a where a.id = :id and a.jobOfferId = :jobOfferId")
    Optional<Application> findByIdAndJobOfferIdForUpdate(@Param("id") UUID id,
            @Param("jobOfferId") UUID jobOfferId);

    Optional<Application> findByCandidateIdAndJobOfferId(UUID candidateId, UUID jobOfferId);

    /** Le CV est-il épinglé par une candidature hors brouillon (transmise, retirée, décidée) ? */
    boolean existsByCvAttachmentIdAndStatusNot(UUID cvAttachmentId, ApplicationStatus status);

    /**
     * Détache un CV des brouillons qui le portent (TD-054) : un brouillon ne
     * fige pas son CV — la transmission reprend alors le CV courant.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Application a set a.cvAttachmentId = null where a.cvAttachmentId = :cvAttachmentId and a.status = :draft")
    int detachCvFromDrafts(UUID cvAttachmentId, ApplicationStatus draft);

    /**
     * Identifiants de la liste recruteur, triés en SQL : le tri par section lit
     * le dernier {@code matching_result.result} (JSONB) et le tri par
     * contestations agrège les feedbacks. Le tri doit précéder la pagination —
     * jamais un tri en mémoire après chargement.
     */
    @Query(value = """
            SELECT a.id
            FROM application a
            LEFT JOIN LATERAL (
                SELECT
                    MAX(CASE WHEN s->>'section' = 'required_skills' THEN (s->>'score')::numeric END) AS required_skills,
                    MAX(CASE WHEN s->>'section' = 'preferred_skills' THEN (s->>'score')::numeric END) AS preferred_skills,
                    MAX(CASE WHEN s->>'section' = 'languages' THEN (s->>'score')::numeric END) AS languages,
                    MAX(CASE WHEN s->>'section' = 'experience' THEN (s->>'score')::numeric END) AS experience,
                    MAX(CASE WHEN s->>'section' = 'education' THEN (s->>'score')::numeric END) AS education
                FROM matching_result r
                CROSS JOIN LATERAL jsonb_array_elements(r.result->'sections') s
                WHERE r.matching_id = a.matching_id
                  AND r.result IS NOT NULL
                  AND r.version = (
                      SELECT MAX(r2.version)
                      FROM matching_result r2
                      WHERE r2.matching_id = a.matching_id
                        AND r2.result IS NOT NULL
                  )
            ) sc ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT f.criterion_key)::int AS contested_count,
                       AVG(ABS(f.self_value - (criterion->>'score')::numeric)) AS average_gap
                FROM matching_result r
                JOIN matching_criterion_feedback f ON f.matching_result_id = r.id
                CROSS JOIN LATERAL jsonb_array_elements(r.result->'sections') s
                CROSS JOIN LATERAL jsonb_array_elements(s->'criteria') criterion
                WHERE r.matching_id = a.matching_id
                  AND r.result IS NOT NULL
                  AND r.version = (
                      SELECT MAX(r2.version)
                      FROM matching_result r2
                      WHERE r2.matching_id = a.matching_id
                        AND r2.result IS NOT NULL
                  )
                  AND criterion->>'key' = f.criterion_key
            ) fb ON TRUE
            WHERE a.job_offer_id = :offerId
              AND a.status = :status
            ORDER BY
                CASE WHEN :sort = 'submittedAt' AND :direction = 'asc' THEN a.submitted_at END ASC NULLS LAST,
                CASE WHEN :sort = 'submittedAt' AND :direction = 'desc' THEN a.submitted_at END DESC NULLS LAST,
                CASE WHEN :sort = 'requiredSkills' AND :direction = 'asc' THEN sc.required_skills END ASC NULLS LAST,
                CASE WHEN :sort = 'requiredSkills' AND :direction = 'desc' THEN sc.required_skills END DESC NULLS LAST,
                CASE WHEN :sort = 'preferredSkills' AND :direction = 'asc' THEN sc.preferred_skills END ASC NULLS LAST,
                CASE WHEN :sort = 'preferredSkills' AND :direction = 'desc' THEN sc.preferred_skills END DESC NULLS LAST,
                CASE WHEN :sort = 'languages' AND :direction = 'asc' THEN sc.languages END ASC NULLS LAST,
                CASE WHEN :sort = 'languages' AND :direction = 'desc' THEN sc.languages END DESC NULLS LAST,
                CASE WHEN :sort = 'experience' AND :direction = 'asc' THEN sc.experience END ASC NULLS LAST,
                CASE WHEN :sort = 'experience' AND :direction = 'desc' THEN sc.experience END DESC NULLS LAST,
                CASE WHEN :sort = 'education' AND :direction = 'asc' THEN sc.education END ASC NULLS LAST,
                CASE WHEN :sort = 'education' AND :direction = 'desc' THEN sc.education END DESC NULLS LAST,
                CASE WHEN :sort = 'contests' THEN fb.contested_count END DESC NULLS LAST,
                CASE WHEN :sort = 'contests' THEN fb.average_gap END DESC NULLS LAST,
                a.submitted_at ASC,
                a.id ASC
            LIMIT :size OFFSET :offset
            """, nativeQuery = true)
    List<UUID> findRecruiterApplicationIds(@Param("offerId") UUID offerId,
            @Param("status") short status,
            @Param("sort") String sort,
            @Param("direction") String direction,
            @Param("size") int size,
            @Param("offset") long offset);

    @Query(value = """
            SELECT COUNT(*)
            FROM application a
            WHERE a.job_offer_id = :offerId
              AND a.status = :status
            """, nativeQuery = true)
    long countRecruiterApplications(@Param("offerId") UUID offerId, @Param("status") short status);

    /**
     * Nombre de candidatures visibles par offre (brouillons et retraits exclus
     * — exactement ce que le recruteur voit dans la liste des candidatures) :
     * un seul GROUP BY pour toute la page, jamais un COUNT par offre (N+1).
     */
    @Query(value = """
            SELECT a.job_offer_id, COUNT(*)::int
            FROM application a
            WHERE a.job_offer_id IN (:offerIds)
              AND a.status NOT IN (:excluded)
            GROUP BY a.job_offer_id
            """, nativeQuery = true)
    List<Object[]> countVisibleApplicationsByOfferIds(@Param("offerIds") List<UUID> offerIds,
            @Param("excluded") List<Short> excluded);

    /**
     * Tableau de bord admin : candidatures visibles (statuts {@code visible}) de toute la plateforme,
     * un seul GROUP BY. Un statut absent du résultat vaut 0.
     */
    @Query(value = """
            SELECT a.status, COUNT(*)
            FROM application a
            WHERE a.status IN (:visible)
            GROUP BY a.status
            """, nativeQuery = true)
    List<Object[]> countVisibleByStatus(@Param("visible") List<Short> visible);

    /** Tableau de bord admin : candidatures visibles transmises à partir de {@code since} (borne incluse). */
    @Query(value = """
            SELECT COUNT(*)
            FROM application a
            WHERE a.status IN (:visible)
              AND a.submitted_at >= :since
            """, nativeQuery = true)
    long countVisibleSubmittedSince(@Param("visible") List<Short> visible, @Param("since") LocalDateTime since);

    /**
     * Tableau de bord recruteur : candidatures visibles (statuts {@code visible} — le
     * périmètre de {@link #countVisibleApplicationsByOfferIds}) de toutes les offres de ces
     * sociétés, un seul GROUP BY. Un statut absent du résultat vaut 0.
     */
    @Query(value = """
            SELECT a.status, COUNT(*)
            FROM application a
            JOIN job_offer o ON o.id = a.job_offer_id
            WHERE o.company_id IN (:companyIds)
              AND a.status IN (:visible)
            GROUP BY a.status
            """, nativeQuery = true)
    List<Object[]> countByStatusForCompanies(@Param("companyIds") Collection<UUID> companyIds,
            @Param("visible") List<Short> visible);
}
