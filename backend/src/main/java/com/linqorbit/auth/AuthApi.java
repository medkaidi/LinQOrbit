package com.linqorbit.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.ChangePasswordRequest;
import com.linqorbit.auth.dto.LoginRequest;
import com.linqorbit.auth.dto.SignupRequest;
import com.linqorbit.auth.dto.UserResponse;

/**
 * Contrat d'API d'authentification : définit les endpoints et leur documentation OpenAPI.
 * Implémenté par {@link AuthController}.
 */
@Tag(name = "Auth", description = "Compte, profil et mot de passe des utilisateurs")
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

    @GetMapping("/me")
    @Operation(summary = "Profil du compte", description = "Retourne le profil du compte associé au jeton JWT fourni.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profil renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<UserResponse> me(Authentication authentication);

    @PostMapping("/change-password")
    @Operation(summary = "Changer le mot de passe", description = "Vérifie le mot de passe actuel puis enregistre le nouveau. Le jeton en cours reste valide jusqu'à son expiration.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Mot de passe modifié"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Mot de passe actuel incorrect")
    })
    ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request, Authentication authentication);
}
