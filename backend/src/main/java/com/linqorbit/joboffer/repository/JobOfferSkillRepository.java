package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.JobOfferSkillId;

/**
 * Accès aux compétences exigées par les offres.
 */
public interface JobOfferSkillRepository extends JpaRepository<JobOfferSkill, JobOfferSkillId> {

    List<JobOfferSkill> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferSkill> findByJobOfferId(UUID jobOfferId);

    void deleteByJobOfferId(UUID jobOfferId);
}
