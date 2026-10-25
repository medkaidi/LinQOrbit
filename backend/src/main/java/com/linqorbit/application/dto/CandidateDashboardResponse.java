package com.linqorbit.application.dto;

import java.util.List;

/**
 * Chiffres du tableau de bord candidat, calculés par le serveur : candidatures
 * par statut, les plus récentes, invitations encore ouvertes (même définition
 * que {@code GET /candidates/me/invitations}) et offres ouvertes du job board
 * (même périmètre que le {@code total} de {@code GET /jobs}). Le profil, le CV
 * et le consentement restent servis par leurs propres endpoints.
 */
public record CandidateDashboardResponse(
        ApplicationCounts applications,
        List<DashboardApplication> recentApplications,
        long openInvitations,
        long openOffers) {
}
