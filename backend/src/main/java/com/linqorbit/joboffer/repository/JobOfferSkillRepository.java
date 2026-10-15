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

    /**
     * Ids des offres ayant au moins une compétence — présence seule, sans
     * charger les lignes (gate {@code readyToPublish} de la liste légère).
     */
    @Query("select distinct s.jobOfferId from JobOfferSkill s where s.jobOfferId in :jobOfferIds")
    List<UUID> findOfferIdsWithSkills(List<UUID> jobOfferIds);

    /** Suppression bulk (une requête SQL, pas de select + delete par ligne). */
    @Modifying
    @Query("delete from JobOfferSkill s where s.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
