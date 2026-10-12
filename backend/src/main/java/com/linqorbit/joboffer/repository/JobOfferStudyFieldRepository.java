package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.JobOfferStudyField;
import com.linqorbit.joboffer.entity.JobOfferStudyFieldId;

/**
 * Accès aux domaines d'études exigés par les offres.
 */
public interface JobOfferStudyFieldRepository extends JpaRepository<JobOfferStudyField, JobOfferStudyFieldId> {

    List<JobOfferStudyField> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferStudyField> findByJobOfferId(UUID jobOfferId);

    void deleteByJobOfferId(UUID jobOfferId);
}
