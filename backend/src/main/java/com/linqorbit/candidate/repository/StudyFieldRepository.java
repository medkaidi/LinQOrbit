package com.linqorbit.candidate.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.StudyField;

public interface StudyFieldRepository extends JpaRepository<StudyField, UUID> {

    List<StudyField> findAllByOrderByLabelAsc();

    /** Vérification en masse (une requête COUNT au lieu de N existsById). */
    long countByIdIn(Collection<UUID> ids);
}
