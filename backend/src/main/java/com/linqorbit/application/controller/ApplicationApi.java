package com.linqorbit.application.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.SubmitApplicationRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API des candidatures (D48–D49) : soumission à une offre publiée,
 * contexte du formulaire, liste « mes candidatures » et retrait. Implémenté
 * par {@link ApplicationController}.
 */
@Tag(name = "Applications", description = "Candidatures du candidat connecté (soumission, suivi, retrait)")
public interface ApplicationApi {

    @PostMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Postuler à une offre",
            description = "Soumission atomique : le CV (choisi ou courant, sinon 409) est épinglé et les questions obligatoires de l'offre doivent être répondues. Une seule candidature par couple (candidat, offre), même après retrait.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Candidature enregistrée"),
            @ApiResponse(responseCode = "400", description = "Réponse invalide, question inconnue, doublon ou CV "
                    + "de sélection inconnu"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée ou expirée"),
            @ApiResponse(responseCode = "409", description = "Candidature déjà déposée ou CV manquant")
    })
    ResponseEntity<ApplicationResponse> submit(@Valid @RequestBody SubmitApplicationRequest request,
            Authentication authentication);

    @GetMapping("/context/{publicId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Contexte du formulaire de candidature",
            description = "Questions de présélection SANS l'information recruteur « preferred », CV courant et candidature existante éventuelle. Même 404 sûr que la lecture publique de l'offre.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contexte renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée ou expirée")
    })
    ResponseEntity<ApplicationContextResponse> context(@PathVariable String publicId,
            Authentication authentication);

    @GetMapping("/mine")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister mes candidatures",
            description = "Candidatures du candidat connecté, plus récentes d'abord, avec les réponses reconstruites dans l'ordre des questions de l'offre.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<ApplicationResponse>> mine(Authentication authentication);

    @PostMapping("/{applicationId}/withdraw")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Retirer une candidature",
            description = "Uniquement tant que la candidature est SUBMITTED — WITHDRAWN est terminal : l'UNIQUE du couple interdit la repostulation.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Candidature retirée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Candidature inconnue pour ce candidat"),
            @ApiResponse(responseCode = "409", description = "Le statut ne permet plus le retrait")
    })
    ResponseEntity<Void> withdraw(@PathVariable UUID applicationId, Authentication authentication);
}
