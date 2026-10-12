package com.linqorbit.joboffer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.joboffer.dto.PublicJobResponse;

/**
 * Contrat de l'offre publique (V15) : lecture d'une offre publiée sans
 * authentification. Implémenté par {@link JobPublicController}.
 */
@Tag(name = "Public jobs", description = "Offres publiées exposées sans authentification (URL publique /jobs/{publicId}-{slug})")
public interface JobPublicApi {

    @GetMapping("/{publicId}")
    @Operation(summary = "Lire une offre publiée", description = "Sans authentification. 404 pour toute offre inconnue, non publiée, clôturée ou expirée — le même détail évite d'énumérer les offres existantes.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Offre publiée renvoyée"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée, clôturée ou expirée")
    })
    ResponseEntity<PublicJobResponse> getJob(@PathVariable String publicId);
}
