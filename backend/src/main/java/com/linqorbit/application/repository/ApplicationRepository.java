package com.linqorbit.application.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.application.entity.Application;
import com.linqorbit.application.entity.ApplicationStatus;

/**
 * Accès aux candidatures : lecture « mes candidatures » (plus récentes
 * d'abord, ordre stable), contrôle propriétaire et garde du couple
 * (candidat, offre) — une candidature par couple.
 */
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByCandidateIdOrderByCreatedAtDescIdDesc(UUID candidateId);

    Optional<Application> findByIdAndCandidateId(UUID id, UUID candidateId);

    Optional<Application> findByCandidateIdAndJobOfferId(UUID candidateId, UUID jobOfferId);

    /** Le CV est-il épinglé par une candidature hors brouillon (transmise, retirée, décidée) ? */
    boolean existsByCvAttachmentIdAndStatusNot(UUID cvAttachmentId, ApplicationStatus status);

    /**
     * Détache un CV des brouillons qui le portent (TD-054) : un brouillon ne
     * fige pas son CV — la transmission reprend alors le CV courant.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Application a set a.cvAttachmentId = null where a.cvAttachmentId = :cvAttachmentId and a.status = :draft")
    int detachCvFromDrafts(UUID cvAttachmentId, ApplicationStatus draft);
}
