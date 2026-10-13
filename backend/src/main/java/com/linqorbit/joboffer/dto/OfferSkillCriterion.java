package com.linqorbit.joboffer.dto;

/**
 * Critère de compétence stocké, tel que transmis au service IA : le
 * requirementType est la vérité plateforme (jamais reclassé par le LLM).
 */
public record OfferSkillCriterion(
        String name,
        String requirementType,
        Integer weight,
        Integer yearsExperience) {
}
