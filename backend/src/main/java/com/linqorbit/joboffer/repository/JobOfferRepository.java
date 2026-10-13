package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import com.linqorbit.joboffer.entity.JobOffer;

/**
 * Accès aux offres d'emploi : lecture par identifiant, liste par companies du
 * recruteur connecté.
 */
public interface JobOfferRepository extends JpaRepository<JobOffer, UUID> {

    Optional<JobOffer> findByIdAndCompanyIdIn(UUID id, List<UUID> companyIds);

    Optional<JobOffer> findByPublicId(String publicId);

    List<JobOffer> findByCompanyIdInOrderByCreatedAtDesc(List<UUID> companyIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from JobOffer o where o.id = :id")
    Optional<JobOffer> findByIdForUpdate(UUID id);
}
