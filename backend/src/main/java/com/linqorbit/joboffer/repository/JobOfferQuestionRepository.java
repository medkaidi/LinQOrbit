package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.joboffer.entity.JobOfferQuestion;

/**
 * Accès aux questions de présélection des offres (D47) : remplacées
 * intégralement à l'édition, lues triées par ordre (id en départage — deux
 * questions au même sort_order restent stables) pour les réponses des offres.
 */
public interface JobOfferQuestionRepository extends JpaRepository<JobOfferQuestion, UUID> {

    List<JobOfferQuestion> findByJobOfferIdInOrderBySortOrderAscIdAsc(List<UUID> jobOfferIds);

    /** Suppression bulk (une requête SQL) — les options suivent par cascade SQL. */
    @Modifying
    @Query("delete from JobOfferQuestion q where q.jobOfferId = :jobOfferId")
    void deleteAllByJobOfferId(UUID jobOfferId);
}
