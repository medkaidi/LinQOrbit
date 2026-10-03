package com.linqorbit.candidate.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.linqorbit.candidate.SkillType;
import com.linqorbit.candidate.SkillTypeConverter;

/**
 * Compétence d'une liste prédéfinie (technique ou comportementale).
 * Table de référence peuplée par migration, jamais par l'application.
 */
@Entity
@Table(name = "skills")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Convert(converter = SkillTypeConverter.class)
    @Column(name = "skill_type", nullable = false)
    private SkillType skillType;
}
