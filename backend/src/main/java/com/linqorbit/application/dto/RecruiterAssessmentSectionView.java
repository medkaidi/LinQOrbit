package com.linqorbit.application.dto;

import java.util.List;

/** Section du matching côté recruteur : score de section et critères justifiés. */
public record RecruiterAssessmentSectionView(
        String section,
        Double score,
        List<RecruiterCriterionView> criteria) {
}
