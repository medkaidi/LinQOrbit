package com.linqorbit.joboffer.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.joboffer.entity.JobOfferStatus;

/**
 * Règle unique de la dernière analyse d'une offre (D90) : le signal exposé
 * {@code analysisOutdated} et la décision de {@code /revalidate} en dérivent,
 * ils ne peuvent pas diverger.
 */
class OfferAnalysisStateTest {

    private static OfferAnalysisState latest(NormalizationJobStatus status, boolean hasContent) {
        return new OfferAnalysisState(true, status, hasContent, false);
    }

    @Test
    void uneOffreSansAucuneVersionEstInexploitable() {
        assertThat(OfferAnalysisState.NONE.unusable()).isTrue();
        assertThat(OfferAnalysisState.NONE.outdated(JobOfferStatus.PUBLISHED)).isTrue();
        assertThat(OfferAnalysisState.NONE.repairable(JobOfferStatus.PUBLISHED)).isTrue();
    }

    @Test
    void unJobDoneSansContenuEstInexploitable() {
        OfferAnalysisState state = latest(NormalizationJobStatus.DONE, false);

        assertThat(state.unusable()).isTrue();
        assertThat(state.outdated(JobOfferStatus.PUBLISHED)).isTrue();
        assertThat(state.repairable(JobOfferStatus.PUBLISHED)).isTrue();
    }

    @Test
    void unJobSupersedeOuAbsentSansContenuEstInexploitable() {
        assertThat(latest(NormalizationJobStatus.SUPERSEDED, false).unusable()).isTrue();
        assertThat(latest(null, false).unusable()).isTrue();
    }

    @Test
    void uneDerniereVersionAvecContenuEstExploitableMemeSansLigneDeJob() {
        assertThat(latest(NormalizationJobStatus.DONE, true).unusable()).isFalse();
        assertThat(latest(null, true).unusable()).isFalse();
        assertThat(latest(NormalizationJobStatus.DONE, true).outdated(JobOfferStatus.PUBLISHED)).isFalse();
    }

    @Test
    void uneAnalyseEnCoursSansContenuNEstJamaisInexploitableNiReparable() {
        for (NormalizationJobStatus status : new NormalizationJobStatus[] {
                NormalizationJobStatus.PENDING, NormalizationJobStatus.RUNNING}) {
            OfferAnalysisState state = latest(status, false);

            assertThat(state.inProgress()).as(status.name()).isTrue();
            assertThat(state.unusable()).as(status.name()).isFalse();
            assertThat(state.outdated(JobOfferStatus.PUBLISHED)).as(status.name()).isFalse();
            assertThat(state.repairable(JobOfferStatus.PUBLISHED)).as(status.name()).isFalse();
        }
    }

    @Test
    void uneAnalyseEnEchecGardeSonPropreSignal() {
        OfferAnalysisState state = latest(NormalizationJobStatus.FAILED, false);

        assertThat(state.failed()).isTrue();
        assertThat(state.unusable()).isFalse();
        assertThat(state.outdated(JobOfferStatus.PUBLISHED)).isFalse();
    }

    @Test
    void unSchemaPerimeEstObsoleteQuelQueSoitLeStatutDeLOffre() {
        OfferAnalysisState state = new OfferAnalysisState(true, NormalizationJobStatus.DONE, true, true);

        for (JobOfferStatus status : JobOfferStatus.values()) {
            assertThat(state.outdated(status)).as(status.name()).isTrue();
        }
    }

    @Test
    void unSchemaPerimeNeRelancePasUneAnalyseEnCours() {
        OfferAnalysisState state = new OfferAnalysisState(true, NormalizationJobStatus.PENDING, true, true);

        assertThat(state.outdated(JobOfferStatus.PUBLISHED)).isTrue();
        assertThat(state.repairable(JobOfferStatus.PUBLISHED)).isFalse();
    }

    @Test
    void lInexploitableNeConcerneQueLesOffresPubliees() {
        OfferAnalysisState state = latest(NormalizationJobStatus.DONE, false);

        for (JobOfferStatus status : JobOfferStatus.values()) {
            assertThat(state.outdated(status)).as(status.name()).isEqualTo(status == JobOfferStatus.PUBLISHED);
        }
    }
}
