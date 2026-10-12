package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.JobOfferDegree;
import com.linqorbit.joboffer.entity.JobOfferDegreeId;

/**
 * Accès aux diplômes exigés par les offres.
 */
public interface JobOfferDegreeRepository extends JpaRepository<JobOfferDegree, JobOfferDegreeId> {

    List<JobOfferDegree> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferDegree> findByJobOfferId(UUID jobOfferId);

    void deleteByJobOfferId(UUID jobOfferId);
}
