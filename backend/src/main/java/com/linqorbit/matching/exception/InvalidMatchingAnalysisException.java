package com.linqorbit.matching.exception;

/**
 * Analyse IA inexploitable (clé manquante ou en trop, score hors bornes,
 * JSON illisible) : jamais exposée à l'utilisateur — le worker la traite comme
 * un échec d'exécution (retry, puis FAILED), son message part en logs et dans
 * {@code matching_job.error}.
 */
public class InvalidMatchingAnalysisException extends RuntimeException {

    public InvalidMatchingAnalysisException(String message) {
        super(message);
    }
}
