package com.linqorbit.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

/**
 * Contrat d'API d'authentification : définit les endpoints et leur documentation OpenAPI.
 * Implémenté par {@link AuthController}.
 */
@Tag(name = "Auth", description = "Inscription et connexion des comptes")
public interface AuthApi {

    @PostMapping("/signup")
    @Operation(summary = "Créer un compte", description = "Inscription d'un nouveau compte. Renvoie un jeton JWT et le profil créé.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Compte créé, jeton renvoyé"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "409", description = "Un compte existe déjà pour cet email")
    })
    ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request);

    @PostMapping("/login")
    @Operation(summary = "Se connecter", description = "Authentifie un compte actif. Renvoie un jeton JWT et le profil.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Connexion réussie, jeton renvoyé"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Email ou mot de passe incorrect"),
            @ApiResponse(responseCode = "403", description = "Compte inactif")
    })
    ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request);
}
