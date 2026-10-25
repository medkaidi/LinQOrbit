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
}
