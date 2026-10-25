package com.linqorbit.invitation.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.linqorbit.invitation.entity.OfferCandidate;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.joboffer.entity.JobOfferStatus;

public interface OfferCandidateRepository extends JpaRepository<OfferCandidate, UUID> {

    /** Suggérés d'une offre dans l'ordre du screening. */
    List<OfferCandidate> findByJobOfferIdOrderByRankAscIdAsc(UUID jobOfferId);

    Optional<OfferCandidate> findByIdAndJobOfferId(UUID id, UUID jobOfferId);

    long countByJobOfferId(UUID jobOfferId);

    /**
     * Relance du screening : seuls les SUGGESTED sont remplacés, les INVITED
     * sont conservés (une invitation envoyée ne disparaît jamais).
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from OfferCandidate oc where oc.jobOfferId = :offerId and oc.status = :status")
    int deleteByJobOfferIdAndStatus(UUID offerId, OfferCandidateStatus status);

    /**
     * SUGGESTED → INVITED, atomique : un seul vainqueur si deux recruteurs
     * invitent en même temps (le perdant obtient 0 et reçoit un 409).
     */
    @Modifying(clearAutomatically = true)
    @Query("""
            update OfferCandidate oc
            set oc.status = :target, oc.invitedByUserId = :userId, oc.invitedAt = :now
            where oc.id = :id and oc.jobOfferId = :offerId and oc.status = :expected""")
    int casInvite(UUID id, UUID offerId, UUID userId, OfferCandidateStatus expected, OfferCandidateStatus target,
            LocalDateTime now);

    /** Parmi ces candidats, ceux qui ont déjà une candidature (tout statut) à l'offre. */
    @Query(value = """
            select a.candidate_id from application a
            where a.job_offer_id = :offerId and a.candidate_id in (:candidateIds)""", nativeQuery = true)
    List<UUID> findCandidateIdsWithApplication(UUID offerId, Collection<UUID> candidateIds);

    /**
     * Invitations en cours d'un candidat : offres encore ouvertes (PUBLISHED et
     * non expirée) auxquelles il n'a pas encore candidaté, la plus récente d'abord.
     */
    @Query("""
            select oc from OfferCandidate oc, JobOffer j
            where oc.jobOfferId = j.id and oc.candidateId = :candidateId
              and oc.status = :invited
              and j.status = :published
              and (j.expiresAt is null or j.expiresAt >= :today)
              and not exists (select 1 from Application a
                              where a.candidateId = oc.candidateId and a.jobOfferId = oc.jobOfferId)
            order by oc.invitedAt desc, oc.id""")
    List<OfferCandidate> findOpenInvitations(UUID candidateId, OfferCandidateStatus invited,
            JobOfferStatus published, LocalDate today);

    /**
     * Nombre d'invitations en cours : <b>même prédicat</b> que
     * {@link #findOpenInvitations} (un test d'intégration épingle l'égalité), sans
     * charger les lignes — tableau de bord candidat.
     */
    @Query("""
            select count(oc) from OfferCandidate oc, JobOffer j
            where oc.jobOfferId = j.id and oc.candidateId = :candidateId
              and oc.status = :invited
              and j.status = :published
              and (j.expiresAt is null or j.expiresAt >= :today)
              and not exists (select 1 from Application a
                              where a.candidateId = oc.candidateId and a.jobOfferId = oc.jobOfferId)""")
    long countOpenInvitations(UUID candidateId, OfferCandidateStatus invited,
            JobOfferStatus published, LocalDate today);

    /**
     * Tableau de bord recruteur, sur les offres ouvertes de ces sociétés et parmi les candidats
     * ayant consenti (relu à chaque lecture, comme la liste des suggestions) : une ligne
     * {@code [à inviter, invités]}. À inviter = suggérés qui n'ont pas candidaté (le
     * {@code canInvite} de la liste) ; invités = lignes INVITED, candidature ou non.
     */
    @Query(value = """
            SELECT COALESCE(SUM(CASE WHEN oc.status = :suggested AND NOT EXISTS (
                                        SELECT 1 FROM application a
                                        WHERE a.candidate_id = oc.candidate_id AND a.job_offer_id = oc.job_offer_id)
                                     THEN 1 ELSE 0 END), 0),
                   COALESCE(SUM(CASE WHEN oc.status = :invited THEN 1 ELSE 0 END), 0)
            FROM offer_candidate oc
            JOIN job_offer o ON o.id = oc.job_offer_id
            JOIN candidates c ON c.id = oc.candidate_id
            WHERE o.company_id IN (:companyIds)
              AND o.status = :published
              AND (o.expires_at IS NULL OR o.expires_at >= :today)
              AND c.recruiter_visibility_consent_at IS NOT NULL
            """, nativeQuery = true)
    List<Object[]> countToInviteAndInvited(@Param("companyIds") Collection<UUID> companyIds,
            @Param("suggested") short suggested, @Param("invited") short invited,
            @Param("published") short published, @Param("today") LocalDate today);
}
