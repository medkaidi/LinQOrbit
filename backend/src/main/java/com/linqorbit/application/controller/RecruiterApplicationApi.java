package com.linqorbit.application.controller;

import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.application.dto.CriterionReportRequest;
import com.linqorbit.application.dto.RecruiterApplicationDetail;
import com.linqorbit.application.dto.RecruiterApplicationPageResponse;
import com.linqorbit.application.dto.RecruiterDecisionRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API de la vue recruteur des candidatures (T-66, D65) : liste
 * paginée et filtrable par statut, détail, CV épinglé et décision manuelle.
 * Implémenté par {@link RecruiterApplicationController}.
 */
@Tag(name = "Recruiter applications", description = "Candidatures d'une offre vues par un membre de sa company")
public interface RecruiterApplicationApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les candidatures d'une offre",
            description = "Défaut SUBMITTED ; ACCEPTED et REJECTED disponibles ; brouillons et retraits invisibles. "
                    + "Tri date de transmission croissante par défaut, par score de section (nulls last) ou par "
                    + "contestations (nombre, écart moyen, date).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page renvoyée"),
            @ApiResponse(responseCode = "400", description = "Statut, tri ou direction invalide"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue ou hors company")
    })
    ResponseEntity<RecruiterApplicationPageResponse> list(@PathVariable UUID offerId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            Authentication authentication);

    @GetMapping("/{applicationId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Détail d'une candidature",
            description = "Réponses recruteur (preferred inclus), paires question/réponse IA, évaluation par "
                    + "critère avec justification, contestations et CV épinglé. canDecide = transmise et droit de "
                    + "gestion D12 (owner ou créateur de l'offre).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Détail renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Candidature inconnue, brouillon ou retirée")
    })
    ResponseEntity<RecruiterApplicationDetail> detail(@PathVariable UUID offerId,
            @PathVariable UUID applicationId, Authentication authentication);

    @GetMapping("/{applicationId}/cv")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Télécharger le CV épinglé",
            description = "Flux PDF du CV utilisé à la transmission, réservé aux membres de la company de l'offre.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Flux du fichier (PDF)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Candidature ou CV introuvable")
    })
    ResponseEntity<Resource> cv(@PathVariable UUID offerId, @PathVariable UUID applicationId,
            Authentication authentication);

    @PostMapping("/{applicationId}/decision")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Accepter ou rejeter une candidature",
            description = "Décision manuelle et terminale (accepted/rejected), owner ou créateur de l'offre. "
                    + "Aucun recalcul IA. 409 si la candidature est déjà décidée.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Décision enregistrée"),
            @ApiResponse(responseCode = "400", description = "Décision invalide"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droit de gestion"),
            @ApiResponse(responseCode = "404", description = "Candidature inconnue, brouillon ou retirée"),
            @ApiResponse(responseCode = "409", description = "Candidature déjà décidée")
    })
    ResponseEntity<Void> decide(@PathVariable UUID offerId, @PathVariable UUID applicationId,
            @Valid @RequestBody RecruiterDecisionRequest request, Authentication authentication);

    @PostMapping("/{applicationId}/criterion-reports")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Signaler une évaluation IA par critère",
            description = "Retour qualité interne sur un critère de l'évaluation affichée (D66) : motif "
                    + "(scoreIncorrect, evidenceWrong, profileMisunderstood, requirementMisunderstood, other) et "
                    + "commentaire facultatif — obligatoire pour le motif « other ». Le critère est désigné par sa "
                    + "clé dans le résultat affiché, résolu par le serveur. Aucun effet sur le score, aucune "
                    + "réévaluation, aucune visibilité côté candidat. 409 si le même auteur a déjà signalé ce "
                    + "critère.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Signalement enregistré"),
            @ApiResponse(responseCode = "400", description = "Critère inconnu, motif invalide ou commentaire exigé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre, candidature ou évaluation introuvable"),
            @ApiResponse(responseCode = "409", description = "Critère déjà signalé ou évaluation absente")
    })
    ResponseEntity<Void> reportCriterion(@PathVariable UUID offerId, @PathVariable UUID applicationId,
            @Valid @RequestBody CriterionReportRequest request, Authentication authentication);
}
