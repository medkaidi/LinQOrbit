package com.linqorbit.joboffer.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Offre telle que le worker la transmet au service IA : vocabulaire en
 * libellés résolus (jamais d'UUID), description déjà passée en texte brut
 * (le HTML riche Tiptap est strippé côté worker — le LLM ne voit que du
 * texte).
 */
public record OfferSnapshot(
        String title,
        String description,
        String seniority,
        Integer requiredExpYear,
        String city,
        String country,
        String contractTypeLabel,
        String employmentTypeLabel,
        String workModeLabel,
        BigDecimal salaryMin,
        BigDecimal salaryMax,
        String salaryCurrency,
        String salaryPeriod,
        OfferCompanySnapshot company,
        List<OfferSkillCriterion> skills,
        List<OfferLanguageCriterion> languages,
        List<String> degreeLabels,
        List<String> studyFieldLabels) {
}
