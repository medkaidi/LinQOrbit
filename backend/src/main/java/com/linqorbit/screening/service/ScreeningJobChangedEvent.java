package com.linqorbit.screening.service;

import java.util.UUID;

/**
 * Un job de screening vient d'être créé ou relancé dans la transaction
 * courante. Traité <b>après commit</b> : le worker ne doit voir la ligne
 * qu'une fois commitée (sinon le claim CAS échouerait et le job resterait
 * PENDING), et le flux SSE ne publie que des états durables.
 *
 * @param dispatch vrai si le job est prêt à être exécuté ; faux s'il attend
 *                 encore le vecteur de l'offre (l'embedding le relancera)
 */
record ScreeningJobChangedEvent(UUID jobId, boolean dispatch) {
}
