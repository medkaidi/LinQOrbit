package com.linqorbit.candidate.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.linqorbit.candidate.entity.Skill;

public interface SkillRepository extends JpaRepository<Skill, UUID> {

    /**
     * Les types sont stockés en SMALLINT converti : le tri se fait sur le code
     * (techniques d'abord), puis sur le nom.
     */
    List<Skill> findAllByOrderBySkillTypeAscNameAsc();
}
