package com.linqorbit.admin;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.admin.dto.AdminDashboardResponse;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API du tableau de bord de la console admin : chiffres agrégés côté serveur sur toute la
 * plateforme. Implémenté par {@link AdminDashboardController}, protégé par le rôle ADMIN (SecurityConfig).
 */
@Tag(name = "Admin dashboard", description = "Chiffres du tableau de bord de la console admin (rôle ADMIN)")
public interface AdminDashboardApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Tableau de bord admin",
            description = "Comptes par statut (actifs / inactifs / suspendus), candidats, recruteurs, admins et nouveaux comptes sur 7 jours ; offres par statut et offres ouvertes (publiées non expirées) ; candidatures à examiner / acceptées / refusées (brouillons et retraits exclus) et nouvelles sur 7 jours ; suggestions de compétences en attente et signalements IA à relire par l'admin courant (ni auteur, ni déjà relu). Chaque compteur est le total de la liste admin correspondante. Une plateforme vide renvoie des zéros.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Chiffres renvoyés (éventuellement tous à zéro)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Rôle ADMIN requis")
    })
    ResponseEntity<AdminDashboardResponse> dashboard(Authentication authentication);
}
