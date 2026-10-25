package com.linqorbit.joboffer.service;

import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.joboffer.entity.JobOfferStatus;

/**
 * Instantané de la dernière analyse d'une offre : l'unique source des signaux
 * {@code normalizationInProgress}, {@code normalizationFailed} et
 * {@code analysisOutdated} exposés par l'API <b>et</b> de la décision de
 * {@code /revalidate} — les deux ne peuvent donc pas diverger (D90).
 *
 * @param hasVersion       l'offre a au moins une version de fiche
 * @param latestStatus     statut du job de la dernière version ({@code null} : ligne de job absente)
 * @param latestHasContent la dernière version porte son contenu
 * @param staleSchema      la fiche de référence (dernière version avec contenu) a un {@code schema_version} périmé
 */
public record OfferAnalysisState(
        boolean hasVersion,
        NormalizationJobStatus latestStatus,
        boolean latestHasContent,
        boolean staleSchema) {

    /** Offre sans aucune version de fiche. */
    public static final OfferAnalysisState NONE = new OfferAnalysisState(false, null, false, false);

    public boolean inProgress() {
        return latestStatus == NormalizationJobStatus.PENDING || latestStatus == NormalizationJobStatus.RUNNING;
    }

    public boolean failed() {
        return latestStatus == NormalizationJobStatus.FAILED;
    }

    /**
     * Aucune analyse exploitable : pas de version, ou dernière analyse
     * terminale (DONE, SUPERSEDED, job absent) sans contenu. Une analyse en
     * cours ou en échec garde son propre signal.
     */
    public boolean unusable() {
        return !hasVersion || (!inProgress() && !failed() && !latestHasContent);
    }

    /**
     * Signal « analyse à rafraîchir » : schéma périmé, ou — sur une offre
     * PUBLISHED seulement — dernière analyse inexploitable.
     */
    public boolean outdated(JobOfferStatus offerStatus) {
        return staleSchema || (offerStatus == JobOfferStatus.PUBLISHED && unusable());
    }

    /** Une analyse à rafraîchir ne relance jamais une analyse PENDING/RUNNING. */
    public boolean repairable(JobOfferStatus offerStatus) {
        return !inProgress() && outdated(offerStatus);
    }
}
