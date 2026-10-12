package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferLanguageId;

/**
 * Accès aux langues exigées par les offres.
 */
public interface JobOfferLanguageRepository extends JpaRepository<JobOfferLanguage, JobOfferLanguageId> {

    List<JobOfferLanguage> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferLanguage> findByJobOfferId(UUID jobOfferId);

    void deleteByJobOfferId(UUID jobOfferId);
}
