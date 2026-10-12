package com.linqorbit.joboffer.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Compétence exigée par une offre (D12) : obligatoire ou souhaitable, avec
 * poids (1–5) et années d'expérience requises — le germe des
 * {@code offer_criteria} de §15.3, pour les compétences seulement. Identifiants
 * en brut, comme {@code UserRole} : aucun proxy JPA dans les requêtes.
 */
@Entity
@Table(name = "job_offer_skill")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PACKAGE)
@Builder
@IdClass(JobOfferSkillId.class)
public class JobOfferSkill {

    @Id
    @Column(name = "job_offer_id", nullable = false)
    private UUID jobOfferId;

    @Id
    @Column(name = "skill_id", nullable = false)
    private UUID skillId;

    @Convert(converter = RequirementTypeConverter.class)
    @Column(name = "requirement_type", nullable = false)
    private RequirementType requirementType;

    @Column(name = "weight", nullable = false)
    private Integer weight;

    @Column(name = "years_experience")
    private Integer yearsExperience;
}
