package com.linqorbit.application.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.linqorbit.application.entity.ApplicationAnswer;

/**
 * Accès aux réponses de candidature : lues par lot pour la liste « mes
 * candidatures » (l'ordre d'affichage suit l'ordre des questions de l'offre,
 * résolu en service). Jamais de mise à jour : un brouillon remplace ses
 * réponses (suppression puis réinsertion par étages, D59) ; dès la
 * transmission elles sont immuables.
 */
public interface ApplicationAnswerRepository extends JpaRepository<ApplicationAnswer, UUID> {

    List<ApplicationAnswer> findByApplicationIdIn(Collection<UUID> applicationIds);

    /**
     * Suppression en bloc des réponses d'un brouillon (une seule requête — les
     * sélections suivent par la cascade SQL de fk_aao_answer).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ApplicationAnswer a where a.applicationId = :applicationId")
    int deleteByApplicationIdInBulk(UUID applicationId);
}
