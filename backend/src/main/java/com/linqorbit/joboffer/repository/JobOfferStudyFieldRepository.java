package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferStudyField;
import com.linqorbit.joboffer.entity.JobOfferStudyFieldId;

/**
 * Accès aux domaines d'études exigés par les offres.
 */
public interface JobOfferStudyFieldRepository extends JpaRepository<JobOfferStudyField, JobOfferStudyFieldId> {

    List<JobOfferStudyField> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferStudyField> findByJobOfferId(UUID jobOfferId);

    /** Suppression bulk (une requête SQL, pas de select + delete par ligne). */
    @Modifying
    @Query("delete from JobOfferStudyField f where f.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
