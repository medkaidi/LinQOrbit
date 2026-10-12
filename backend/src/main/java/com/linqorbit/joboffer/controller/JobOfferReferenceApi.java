package com.linqorbit.joboffer.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.joboffer.dto.LabelOption;

/**
 * Contrat d'API des listes de référence d'offre (D14) : définit les endpoints
 * et leur documentation OpenAPI. Implémenté par
 * {@link JobOfferReferenceController}.
 */
@Tag(name = "Job offer references", description = "Vocabulaires fermés des offres (contract type, employment type, work mode, D14)")
public interface JobOfferReferenceApi {

    @GetMapping("/contract-types")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les types de contrat", description = "Vocabulaire fermé seedé en migration (D14).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<LabelOption>> contractTypes(Authentication authentication);

    @GetMapping("/employment-types")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les types d'emploi", description = "Temps de travail : Full-time, Part-time (D14).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<LabelOption>> employmentTypes(Authentication authentication);

    @GetMapping("/work-modes")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les modes de travail", description = "Remote, Hybrid, On-site (D14).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<LabelOption>> workModes(Authentication authentication);
}
