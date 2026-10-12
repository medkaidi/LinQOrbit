package com.linqorbit.company.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.company.dto.CompanyResponse;
import com.linqorbit.company.dto.CreateCompanyRequest;
import com.linqorbit.company.dto.UpdateCompanyRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API des companies : définit les endpoints et leur documentation
 * OpenAPI. Implémenté par {@link CompanyController}.
 */
@Tag(name = "Companies", description = "Entreprises des recruteurs (owner / membre, D11–D12)")
public interface CompanyApi {

    @PostMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Créer une company", description = "Tout recruteur peut créer une company et en devient l'owner. Renvoie 404 si le compte n'a pas encore de profil recruteur (onboarding).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Company créée, créateur = owner"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur pour ce compte")
    })
    ResponseEntity<CompanyResponse> create(@Valid @RequestBody CreateCompanyRequest request,
            Authentication authentication);

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister mes companies", description = "Companies dont le compte est membre ou owner, avec le rôle coarse isOwner.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée (vide si aucune)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur pour ce compte")
    })
    ResponseEntity<List<CompanyResponse>> listMine(Authentication authentication);

    @GetMapping("/{companyId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire une company", description = "Réservée aux membres : un compte non-membre reçoit le même 404 qu'une company inexistante (aucune fuite d'existence).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Company renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Company inexistante ou compte non-membre")
    })
    ResponseEntity<CompanyResponse> get(@PathVariable UUID companyId, Authentication authentication);

    @PutMapping("/{companyId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Mettre à jour une company", description = "Owner seul (D12). Name : null = inchangé, vide = refusé ; description : null = inchangé, vide = effacé.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Company enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre non-owner"),
            @ApiResponse(responseCode = "404", description = "Company inexistante ou compte non-membre")
    })
    ResponseEntity<Void> update(@PathVariable UUID companyId, @Valid @RequestBody UpdateCompanyRequest request,
            Authentication authentication);
}
