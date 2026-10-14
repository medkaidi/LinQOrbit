package com.linqorbit.candidate.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.Language;

public interface LanguageRepository extends JpaRepository<Language, UUID> {

    List<Language> findAllByOrderByNameAsc();

    /** Vérification en masse (une requête COUNT au lieu de N existsById). */
    long countByIdIn(Collection<UUID> ids);
}
