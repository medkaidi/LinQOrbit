package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferDegree;
import com.linqorbit.joboffer.entity.JobOfferDegreeId;

/**
 * Accès aux diplômes exigés par les offres.
 */
public interface JobOfferDegreeRepository extends JpaRepository<JobOfferDegree, JobOfferDegreeId> {

    List<JobOfferDegree> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferDegree> findByJobOfferId(UUID jobOfferId);

    /** Suppression bulk (une requête SQL, pas de select + delete par ligne). */
    @Modifying
    @Query("delete from JobOfferDegree d where d.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
