package com.linqorbit.invitation.dto;

import java.util.List;

/**
 * Candidats suggérés d'une offre publiée, dans l'ordre du screening.
 * {@code canInvite} est calculé par le serveur (droit de gestion D12 de
 * l'offre) : le frontend ne le déduit jamais.
 */
public record SuggestedCandidatesResponse(boolean canInvite, List<SuggestedCandidateCard> items) {
}
