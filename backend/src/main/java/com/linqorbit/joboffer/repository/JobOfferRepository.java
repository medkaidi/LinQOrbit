package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;

/**
 * Accès aux offres d'emploi : lecture par identifiant, liste par companies du
 * recruteur connecté, liste globale paginée pour la console admin (D33).
 */
public interface JobOfferRepository extends JpaRepository<JobOffer, UUID> {

    Optional<JobOffer> findByIdAndCompanyIdIn(UUID id, List<UUID> companyIds);

    Optional<JobOffer> findByPublicId(String publicId);

    /** Offres des companies du recruteur, paginées (D34 — count auto Spring Data). */
    Page<JobOffer> findByCompanyIdIn(List<UUID> companyIds, Pageable pageable);

    /** Console admin : toutes les offres d'un statut, paginées (D33). */
    Page<JobOffer> findByStatus(JobOfferStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from JobOffer o where o.id = :id")
    Optional<JobOffer> findByIdForUpdate(UUID id);
}
