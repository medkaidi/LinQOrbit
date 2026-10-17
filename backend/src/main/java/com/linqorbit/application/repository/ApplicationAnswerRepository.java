package com.linqorbit.application.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.application.entity.ApplicationAnswer;

/**
 * Accès aux réponses de candidature : lues par lot pour la liste « mes
 * candidatures » (l'ordre d'affichage suit l'ordre des questions de l'offre,
 * résolu en service). Réponses immuables : jamais de mise à jour.
 */
public interface ApplicationAnswerRepository extends JpaRepository<ApplicationAnswer, UUID> {

    List<ApplicationAnswer> findByApplicationIdIn(Collection<UUID> applicationIds);
}
