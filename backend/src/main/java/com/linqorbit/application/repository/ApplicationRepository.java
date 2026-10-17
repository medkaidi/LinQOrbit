package com.linqorbit.application.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.application.entity.Application;

/**
 * Accès aux candidatures : lecture « mes candidatures » (plus récentes
 * d'abord, ordre stable), contrôle propriétaire et garde du couple
 * (candidat, offre) — une candidature par couple.
 */
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByCandidateIdOrderByCreatedAtDescIdDesc(UUID candidateId);

    Optional<Application> findByIdAndCandidateId(UUID id, UUID candidateId);

    Optional<Application> findByCandidateIdAndJobOfferId(UUID candidateId, UUID jobOfferId);

    boolean existsByCandidateIdAndJobOfferId(UUID candidateId, UUID jobOfferId);
}
