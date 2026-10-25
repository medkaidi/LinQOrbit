package com.linqorbit.screening.controller;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.screening.dto.ScreeningSignal;

/**
 * Contrat d'API du screening automatique d'une offre publiée (T-101, D85) :
 * suivi du statut en SSE et relance après échec. Implémenté par
 * {@link ScreeningController}.
 */
@Tag(name = "Offer screening", description = "Recherche automatique de candidats à la publication d'une offre")
public interface ScreeningApi {

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Suivre la recherche de candidats d'une offre (SSE)",
            description = "Membre de la company de l'offre. Flux text/event-stream : un événement « status » {status, candidateCount} à l'abonnement (statut du dernier job : pending, running, done, failed, ou none sans recherche) puis à chaque transition publiée après commit ; candidateCount n'est renseigné que pour done. Le flux se ferme sur tout statut hors pending/running et après 120 s (le client se reconnecte). Signal seulement — l'offre se relit par GET /job-offers/{offerId}. Jeton en en-tête Authorization (jamais dans l'URL).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Flux ouvert"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou hors des companies du recruteur")
    })
    SseEmitter events(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/retry")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Relancer une recherche de candidats échouée",
            description = "Owner de la company ou créateur de l'offre ; FAILED → PENDING (tentatives remises à zéro, même job). Jamais sur une liste déjà affichée (done) ni sur une recherche en cours.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Relance acceptée, la recherche repasse en attente"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits de gestion sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "La dernière recherche n'est pas en échec, ou l'offre n'est plus publiée")
    })
    ResponseEntity<ScreeningSignal> retry(@PathVariable UUID offerId, Authentication authentication);
}
