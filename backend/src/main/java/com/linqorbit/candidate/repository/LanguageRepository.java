package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.Language;

public interface LanguageRepository extends JpaRepository<Language, UUID> {

    List<Language> findAllByOrderByNameAsc();
}
