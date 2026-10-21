package com.linqorbit.application.dto;

import java.util.List;

/** Page de candidatures d'une offre, avec le contexte d'offre pour l'en-tête. */
public record RecruiterApplicationPageResponse(
        RecruiterJobSummary job,
        List<RecruiterApplicationCard> items,
        int page,
        int size,
        long total) {
}
