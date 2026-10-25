package com.linqorbit.invitation.dto;

import java.time.LocalDateTime;
import java.util.UUID;

import com.linqorbit.application.dto.ApplicationJobSummary;

/**
 * Invitation à candidater reçue par le candidat : l'offre (même résumé que
 * « My applications ») et la date d'envoi. Ne révèle ni le recruteur, ni le
 * rang, ni la distance du screening.
 */
public record CandidateInvitationResponse(UUID id, LocalDateTime invitedAt, ApplicationJobSummary job) {
}
