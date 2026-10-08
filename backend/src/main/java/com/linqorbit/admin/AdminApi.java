package com.linqorbit.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.ApproveSkillSuggestionRequest;
import com.linqorbit.admin.dto.LinkSkillSuggestionRequest;
import com.linqorbit.admin.dto.UpdateUserStatusRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API d'administration : comptes (liste, statut) et file de suggestions
 * de compétences (liste, approbation, lien, rejet). Implémenté par
 * {@link AdminController}, protégé par le rôle ADMIN (SecurityConfig).
 */
@Tag(name = "Admin", description = "Administration : comptes et suggestions de compétences (rôle ADMIN)")
public interface AdminApi {

    @GetMapping("/users")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les comptes", description = "Tous les comptes avec statut et rôles de capacité, triés par nom.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Comptes renvoyés"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<List<AdminUserResponse>> listUsers();

    @PatchMapping("/users/{userId}/status")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Activer ou désactiver un compte", description = "Passe le statut à ACTIVE ou INACTIVE (SUSPENDED refusé ici). Refuse de modifier le propre compte de l'administrateur. Un compte inactif ne peut plus se connecter.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Statut mis à jour"),
            @ApiResponse(responseCode = "400", description = "Statut non supporté ou tentative d'auto-modification"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable")
    })
    ResponseEntity<Void> updateUserStatus(@PathVariable("userId") UUID userId,
            @Valid @RequestBody UpdateUserStatusRequest request, Authentication authentication);

    @GetMapping("/skill-suggestions")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les suggestions de compétences", description = "File de revue : noms proposés par les candidats, absents du catalogue, du plus récent au plus ancien.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Suggestions renvoyées"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<List<AdminSkillSuggestionResponse>> listSkillSuggestions();

    @PostMapping("/skill-suggestions/{id}/approve")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Approuver une suggestion de compétence",
            description = "Crée la compétence dans le catalogue (catégorie existante + type tech/soft), l'ajoute au profil au niveau 1 de chaque auteur de suggestions homonymes et retire tout le groupe de la file.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion approuvée"),
            @ApiResponse(responseCode = "400", description = "Catégorie inconnue ou type invalide"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> approveSkillSuggestion(@PathVariable("id") UUID id,
            @Valid @RequestBody ApproveSkillSuggestionRequest request, Authentication authentication);

    @PostMapping("/skill-suggestions/{id}/link")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Relier une suggestion à une compétence existante",
            description = "Branche le skill catalogue choisi dans le profil au niveau 1 de chaque auteur de suggestions homonymes et retire tout le groupe de la file. Ni création ni suppression dans le catalogue.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion reliée"),
            @ApiResponse(responseCode = "400", description = "Compétence inconnue"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> linkSkillSuggestion(@PathVariable("id") UUID id,
            @Valid @RequestBody LinkSkillSuggestionRequest request, Authentication authentication);

    @PostMapping("/skill-suggestions/{id}/reject")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Rejeter une suggestion de compétence",
            description = "Retire de la file le groupe des suggestions homonymes. Aucun profil touché.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion rejetée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> rejectSkillSuggestion(@PathVariable("id") UUID id, Authentication authentication);
}
