package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.JobOfferSkillId;

/**
 * Accès aux compétences exigées par les offres.
 */
public interface JobOfferSkillRepository extends JpaRepository<JobOfferSkill, JobOfferSkillId> {

    List<JobOfferSkill> findByJobOfferIdIn(List<UUID> jobOfferIds);

    List<JobOfferSkill> findByJobOfferId(UUID jobOfferId);

    /** Suppression bulk (une requête SQL, pas de select + delete par ligne). */
    @Modifying
    @Query("delete from JobOfferSkill s where s.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
