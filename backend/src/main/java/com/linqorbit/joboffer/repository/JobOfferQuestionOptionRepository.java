package com.linqorbit.joboffer.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.joboffer.entity.JobOfferQuestionOption;

/**
 * Accès aux options des questions de choix (D47) : lues triées par ordre (id
 * en départage), remplacées par cascade SQL quand les questions le sont.
 */
public interface JobOfferQuestionOptionRepository extends JpaRepository<JobOfferQuestionOption, UUID> {

    List<JobOfferQuestionOption> findByQuestionIdInOrderBySortOrderAscIdAsc(List<UUID> questionIds);
}
