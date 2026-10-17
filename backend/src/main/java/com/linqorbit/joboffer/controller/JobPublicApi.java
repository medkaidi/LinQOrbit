package com.linqorbit.joboffer.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.joboffer.dto.PublicJobPageResponse;
import com.linqorbit.joboffer.dto.PublicJobResponse;

/**
 * Contrat de l'offre publique (V15/T-72) : lecture sans authentification —
 * job board paginé et fiche d'une offre publiée. Implémenté par
 * {@link JobPublicController}.
 */
@Tag(name = "Public jobs", description = "Offres publiées exposées sans authentification (job board /jobs et URL publique /jobs/{publicId}-{slug})")
public interface JobPublicApi {

    @GetMapping
    @Operation(summary = "Lister les offres publiées (paginé)", description = "Sans authentification. Seules les offres publiées et non expirées, de la plus récente publication à la plus ancienne — enveloppe {items, page, size, total}, la taille de page est décidée par le backend.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page d'offres publiées renvoyée")
    })
    ResponseEntity<PublicJobPageResponse> listJobs(@RequestParam(required = false) Integer page);

    @GetMapping("/{publicId}")
    @Operation(summary = "Lire une offre publiée", description = "Sans authentification. 404 pour toute offre inconnue, non publiée, clôturée ou expirée — le même détail évite d'énumérer les offres existantes.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Offre publiée renvoyée"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée, clôturée ou expirée")
    })
    ResponseEntity<PublicJobResponse> getJob(@PathVariable String publicId);
}
