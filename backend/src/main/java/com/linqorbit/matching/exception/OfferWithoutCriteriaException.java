package com.linqorbit.matching.exception;

/**
 * La fiche normalisée de l'offre épinglée par le matching ne donne aucun
 * critère à noter : la fiche ne changera pas d'une exécution à l'autre, le
 * worker fait donc échouer le job tout de suite, sans nouvelle tentative et
 * sans appel IA. Jamais exposée à l'utilisateur — le candidat voit l'échec
 * générique d'analyse, le détail reste dans les logs et
 * {@code matching_job.error}.
 */
public class OfferWithoutCriteriaException extends InvalidMatchingAnalysisException {

    public OfferWithoutCriteriaException(String message) {
        super(message);
    }
}
