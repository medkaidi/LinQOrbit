package com.linqorbit.application.dto;

/**
 * Avancement de l'évaluation IA du couple (T-62/T-63), calculé par le
 * serveur pour l'indicateur d'étapes : sur le matching courant tant que la
 * candidature n'est pas transmise, sur le matching rattaché ensuite.
 * {@code matched} : un matching existe ; {@code assessmentFinished} : les
 * clarifications sont closes ; {@code contested} : le candidat a contesté au
 * moins un critère.
 */
public record ApplicationAssessmentView(
        boolean matched,
        boolean assessmentFinished,
        boolean contested) {

    public static final ApplicationAssessmentView NONE = new ApplicationAssessmentView(false, false, false);
}
