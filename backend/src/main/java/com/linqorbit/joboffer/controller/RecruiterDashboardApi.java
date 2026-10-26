package com.linqorbit.joboffer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse;

/**
 * Contrat d'API du tableau de bord recruteur : chiffres agrégés côté serveur sur les offres de toutes
 * ses sociétés. Implémenté par {@link RecruiterDashboardController}.
 */
@Tag(name = "Recruiter dashboard", description = "Chiffres du tableau de bord du recruteur connecté")
public interface RecruiterDashboardApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Tableau de bord du recruteur",
            description = "Offres par statut, offres ouvertes (publiées non expirées), offres proches de l'échéance (30 jours), candidatures à examiner / acceptées / refusées (brouillons et retraits exclus), candidats à inviter / invités (sur les offres ouvertes, parmi les candidats ayant consenti et encore en recherche active — un candidat passé not_looking sort des deux compteurs), recherches de candidats en échec et jusqu'à 5 offres demandant une action. Périmètre : les offres des sociétés dont le compte est membre. Un recruteur sans société obtient des zéros et une liste vide.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Chiffres renvoyés (éventuellement tous à zéro)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Le compte n'a pas encore de profil recruteur")
    })
    ResponseEntity<RecruiterDashboardResponse> dashboard(Authentication authentication);
}
