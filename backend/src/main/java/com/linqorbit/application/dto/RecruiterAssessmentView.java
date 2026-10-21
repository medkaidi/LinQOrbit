package com.linqorbit.application.dto;

import java.util.List;

/** Évaluation épinglée d'une candidature ; {@code available=false} sans résultat terminé. */
public record RecruiterAssessmentView(
        boolean available,
        List<RecruiterAssessmentSectionView> sections) {
}
