package com.linqorbit.application.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.application.entity.ApplicationAnswerOption;

/**
 * Accès aux sélections des questions à choix : lues par lot de réponses pour
 * la reconstruction des valeurs de la liste « mes candidatures ».
 */
public interface ApplicationAnswerOptionRepository extends JpaRepository<ApplicationAnswerOption, UUID> {

    List<ApplicationAnswerOption> findByApplicationAnswerIdIn(Collection<UUID> applicationAnswerIds);
}
