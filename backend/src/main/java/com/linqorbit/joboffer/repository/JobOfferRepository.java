package com.linqorbit.joboffer.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;

/**
 * Accès aux offres d'emploi : lecture par identifiant, liste par companies du
 * recruteur connecté, la liste globale de la console admin passe par {@link JobOfferSearchRepository}.
 */
public interface JobOfferRepository extends JpaRepository<JobOffer, UUID> {

    Optional<JobOffer> findByIdAndCompanyIdIn(UUID id, List<UUID> companyIds);

    Optional<JobOffer> findByPublicId(String publicId);

    /**
     * « Autres offres » de la fiche publique (T-74) : offres publiées non
     * expirées de la même entreprise, l'offre de référence exclue.
     */
    @Query("""
            select o from JobOffer o
            where o.status = :status
              and o.companyId = :companyId
              and o.publicId <> :publicId
              and (o.expiresAt is null or o.expiresAt >= :today)""")
    Page<JobOffer> findPublicRelated(JobOfferStatus status, LocalDate today, UUID companyId,
            String publicId, Pageable pageable);

    /**
     * Offres ouvertes du job board (publiées, non expirées) : le périmètre
     * public de {@code GET /jobs} sans filtre, compté sans charger les lignes
     * (tableau de bord candidat). Index {@code ix_job_offer_status_published} (V32).
     */
    @Query("""
            select count(o) from JobOffer o
            where o.status = :status
              and (o.expiresAt is null or o.expiresAt >= :today)""")
    long countOpen(JobOfferStatus status, LocalDate today);

    /** Tableau de bord admin : toutes les offres par statut, un seul GROUP BY. Un statut absent vaut 0. */
    @Query("select o.status, count(o) from JobOffer o group by o.status")
    List<Object[]> countByStatus();

    /** Tableau de bord recruteur : offres de ces sociétés par statut, un seul GROUP BY. Un statut absent vaut 0. */
    @Query("select o.status, count(o) from JobOffer o where o.companyId in :companyIds group by o.status")
    List<Object[]> countByStatusForCompanies(Collection<UUID> companyIds);

    /** Offres ouvertes de ces sociétés : le prédicat de {@link #countOpen}, borné aux sociétés du recruteur. */
    @Query("""
            select count(o) from JobOffer o
            where o.companyId in :companyIds
              and o.status = :status
              and (o.expiresAt is null or o.expiresAt >= :today)""")
    long countOpenForCompanies(Collection<UUID> companyIds, JobOfferStatus status, LocalDate today);

    /**
     * Offres publiées dont l'échéance tombe dans {@code [from, until]} (bornes incluses, comme le
     * filtre « expiringSoon » de la liste) : une ligne {@code [nombre, plus proche échéance ou null]}.
     */
    @Query("""
            select count(o), min(o.expiresAt) from JobOffer o
            where o.companyId in :companyIds
              and o.status = :status
              and o.expiresAt >= :from and o.expiresAt <= :until""")
    List<Object[]> closingSoonForCompanies(Collection<UUID> companyIds, JobOfferStatus status, LocalDate from,
            LocalDate until);

    /**
     * Offres à regarder en premier : celles qui ont des candidatures à examiner (le plus
     * en premier), puis les offres publiées proches de l'échéance. Bornée par {@code limit}.
     */
    @Query(value = """
            SELECT o.id
            FROM job_offer o
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS n
                FROM application a
                WHERE a.job_offer_id = o.id AND a.status = :submitted
            ) pending ON TRUE
            WHERE o.company_id IN (:companyIds)
              AND (pending.n > 0
                   OR (o.status = :published AND o.expires_at >= :from AND o.expires_at <= :until))
            ORDER BY pending.n DESC, o.expires_at ASC NULLS LAST, o.id ASC
            LIMIT :limit
            """, nativeQuery = true)
    List<UUID> findAttentionOfferIds(@Param("companyIds") Collection<UUID> companyIds,
            @Param("submitted") short submitted, @Param("published") short published,
            @Param("from") LocalDate from, @Param("until") LocalDate until, @Param("limit") int limit);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from JobOffer o where o.id = :id")
    Optional<JobOffer> findByIdForUpdate(UUID id);
}
