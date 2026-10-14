package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferLanguageId;

/**
 * Accès aux langues exigées par les offres.
 */
public interface JobOfferLanguageRepository extends JpaRepository<JobOfferLanguage, JobOfferLanguageId> {

    List<JobOfferLanguage> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferLanguage> findByJobOfferId(UUID jobOfferId);

    /** Suppression bulk (une requête SQL, pas de select + delete par ligne). */
    @Modifying
    @Query("delete from JobOfferLanguage l where l.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
