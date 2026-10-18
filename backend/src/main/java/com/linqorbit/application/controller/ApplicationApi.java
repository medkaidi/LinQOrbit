package com.linqorbit.application.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
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

import com.linqorbit.application.dto.ApplicationContextResponse;
import com.linqorbit.application.dto.ApplicationResponse;
import com.linqorbit.application.dto.SaveApplicationDraftRequest;
import com.linqorbit.application.dto.SubmitApplicationRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API des candidatures (D48–D49, révisées par D59) : parcours en
 * brouillon (enregistrement des réponses, transmission, abandon), contexte du
 * parcours, liste « mes candidatures » et retrait. Implémenté par
 * {@link ApplicationController}.
 */
@Tag(name = "Applications", description = "Candidatures du candidat connecté (brouillon, transmission, suivi, retrait)")
public interface ApplicationApi {

    @PutMapping("/draft")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Enregistrer le brouillon de candidature",
            description = "Crée le brouillon du couple (candidat, offre) au premier appel — CV courant renseigné s'il existe — puis remplace ses réponses. Un brouillon peut être partiel ; chaque réponse fournie doit être valide.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Brouillon enregistré"),
            @ApiResponse(responseCode = "400", description = "Réponse invalide, question inconnue ou doublon"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée ou expirée"),
            @ApiResponse(responseCode = "409", description = "Candidature déjà transmise")
    })
    ResponseEntity<ApplicationResponse> saveDraft(@Valid @RequestBody SaveApplicationDraftRequest request,
            Authentication authentication);

    @PostMapping("/{applicationId}/submit")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Transmettre la candidature",
            description = "DRAFT → SUBMITTED : toutes les questions obligatoires doivent être répondues ; le CV (choisi, sinon celui du brouillon, sinon le courant — 409 sans CV) est épinglé et les réponses deviennent immuables. Le matching du couple pour la fiche courante est rattaché s'il existe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Candidature transmise"),
            @ApiResponse(responseCode = "400", description = "Obligatoire sans réponse ou CV choisi inconnu"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Candidature inconnue ou offre fermée"),
            @ApiResponse(responseCode = "409", description = "Déjà transmise ou CV manquant")
    })
    ResponseEntity<ApplicationResponse> submit(@PathVariable UUID applicationId,
            @RequestBody(required = false) SubmitApplicationRequest request, Authentication authentication);

    @DeleteMapping("/{applicationId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Abandonner le brouillon",
            description = "Supprime un brouillon et ses réponses ; le matching du couple est conservé. Une candidature transmise se retire, elle ne s'abandonne pas.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Brouillon supprimé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Candidature inconnue pour ce candidat"),
            @ApiResponse(responseCode = "409", description = "Candidature déjà transmise")
    })
    ResponseEntity<Void> discard(@PathVariable UUID applicationId, Authentication authentication);

    @GetMapping("/context/{publicId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Contexte du parcours de candidature",
            description = "Questions de présélection SANS l'information recruteur « preferred », CV courant, candidature du couple avec ses réponses, étape calculée (recruiter_questions, matching, submitted) et canSubmit. Même 404 sûr que la lecture publique de l'offre.")
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
            description = "Candidatures du candidat connecté, brouillons compris, plus récentes d'abord, avec les réponses reconstruites dans l'ordre des questions de l'offre.")
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
