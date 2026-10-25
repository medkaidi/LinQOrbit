package com.linqorbit.application.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.application.dto.CandidateDashboardResponse;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API du tableau de bord candidat : chiffres agrégés côté serveur
 * (candidatures, invitations, offres ouvertes). Implémenté par
 * {@link CandidateDashboardController}.
 */
@Tag(name = "Candidate dashboard", description = "Chiffres du tableau de bord du candidat connecté")
public interface CandidateDashboardApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Tableau de bord du candidat",
            description = "Candidatures par statut (brouillon, transmise, retirée, acceptée, refusée), les 4 plus récentes (plus récentes d'abord), nombre d'invitations ouvertes (même définition que « Mes invitations ») et nombre d'offres ouvertes du job board (publiées, non expirées). Un compte sans candidature obtient des zéros et une liste vide. Le profil, le CV et le consentement se lisent sur leurs propres endpoints.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Chiffres renvoyés (éventuellement tous à zéro)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<CandidateDashboardResponse> dashboard(Authentication authentication);
}
