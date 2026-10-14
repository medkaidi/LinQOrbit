package com.linqorbit.candidate.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.Skill;

public interface SkillRepository extends JpaRepository<Skill, UUID> {

    /**
     * Les types sont stockés en SMALLINT converti : le tri se fait sur le code
     * (techniques d'abord), puis sur le nom.
     */
    List<Skill> findAllByOrderBySkillTypeAscNameAsc();

    /** Présence au catalogue indifféremment de la casse (revue des suggestions). */
    Optional<Skill> findByNameIgnoreCase(String name);

    /** Vérification en masse (une requête COUNT au lieu de N existsById). */
    long countByIdIn(Collection<UUID> ids);
}
