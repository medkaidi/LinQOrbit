package com.linqorbit.matching.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.StartMatchingRequest;

/**
 * Contrat d'API du matching côté candidat (D58–D59) : lancement ou reprise de
 * l'analyse et lecture du résultat courant. Implémenté par
 * {@link MatchingController}.
 */
@Tag(name = "Matchings", description = "Matching du candidat connecté avec une offre publiée")
public interface MatchingApi {

    @PostMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lancer ou reprendre le matching",
            description = "Exige un brouillon de candidature dont les questions obligatoires sont répondues et les fiches normalisées à jour des deux côtés. Fiche candidat inchangée → le matching existant est repris ; analyse en échec → relancée (nouvelle version). Analyse asynchrone : suivre le statut par la lecture.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Matching lancé ou repris"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée ou expirée"),
            @ApiResponse(responseCode = "409", description = "Questions obligatoires sans réponse, candidature "
                    + "transmise, ou fiche normalisée absente ou périmée")
    })
    ResponseEntity<MatchingResponse> start(@Valid @RequestBody StartMatchingRequest request,
            Authentication authentication);

    @GetMapping("/offer/{publicId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire le matching courant",
            description = "Matching du couple pour la fiche courante du candidat : statut de l'analyse et, une fois terminée, le score de chaque critère par section (ni poids, ni score de section, ni justification).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Matching renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible ou aucun matching lancé"),
            @ApiResponse(responseCode = "409", description = "Candidature transmise (accès fermé)")
    })
    ResponseEntity<MatchingResponse> current(@PathVariable String publicId, Authentication authentication);

    @GetMapping(value = "/offer/{publicId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Suivre le statut du matching (SSE)",
            description = "Flux text/event-stream : un événement « status » {matchingId, status} à l'abonnement (statut courant) puis à chaque transition de l'analyse ; le flux se ferme sur done ou failed. Signal seulement — le résultat se relit par GET /matchings/offer/{publicId}. Jeton en en-tête Authorization (jamais dans l'URL).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Flux ouvert"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible ou aucun matching lancé"),
            @ApiResponse(responseCode = "409", description = "Candidature transmise (accès fermé)")
    })
    SseEmitter events(@PathVariable String publicId, Authentication authentication);
}
