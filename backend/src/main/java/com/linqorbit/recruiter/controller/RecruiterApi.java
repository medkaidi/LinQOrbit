package com.linqorbit.recruiter.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.recruiter.dto.RecruiterResponse;
import com.linqorbit.recruiter.dto.UpdateRecruiterRequest;

/**
 * Contrat d'API du profil recruteur : définit les endpoints et leur
 * documentation OpenAPI. Implémenté par {@link RecruiterController}.
 */
@Tag(name = "Recruiter profile", description = "Identité recruteur du compte connecté (création explicite, D10)")
public interface RecruiterApi {

    @PostMapping("/me")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Activer le profil recruteur", description = "Crée la ligne recruteur du compte (action explicite, jamais à la lecture). Renvoie 409 si le compte a déjà un profil recruteur.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Profil recruteur créé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "409", description = "Le compte a déjà un profil recruteur")
    })
    ResponseEntity<RecruiterResponse> create(Authentication authentication);

    @GetMapping("/me")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire le profil recruteur", description = "Renvoie 404 si le compte n'a pas encore de profil recruteur — le frontend déclenche alors l'onboarding (essai 14 jours, D16).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profil recruteur renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur pour ce compte")
    })
    ResponseEntity<RecruiterResponse> get(Authentication authentication);

    @PutMapping("/me")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Mettre à jour le profil recruteur", description = "Headline et bio optionnels : null = inchangé, chaîne vide = effacé. Renvoie 404 si le compte n'a pas encore de profil recruteur.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Profil recruteur enregistré"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur pour ce compte")
    })
    ResponseEntity<Void> update(@Valid @RequestBody UpdateRecruiterRequest request, Authentication authentication);
}
