package com.linqorbit.joboffer.controller;

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
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.joboffer.dto.CreateJobOfferRequest;
import com.linqorbit.joboffer.dto.JobOfferPageResponse;
import com.linqorbit.joboffer.dto.JobOfferResponse;
import com.linqorbit.joboffer.dto.UpdateJobOfferRequest;

/**
 * Contrat d'API des offres d'emploi : définit les endpoints et leur
 * documentation OpenAPI. Implémenté par {@link JobOfferController}.
 */
@Tag(name = "Job offers", description = "Offres d'emploi des companies (DRAFT → VALIDATED → PUBLISHED → CLOSED, D12–D14)")
public interface JobOfferApi {

    @PostMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Créer une offre", description = "Réservé aux membres de la company ; l'offre est créée en DRAFT. Le recruteur créateur en devient le gestionnaire.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Offre créée en DRAFT"),
            @ApiResponse(responseCode = "400", description = "Corps invalide ou référence de vocabulaire inconnue"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur ou non-membre de la company")
    })
    ResponseEntity<JobOfferResponse> create(@Valid @RequestBody CreateJobOfferRequest request,
            Authentication authentication);

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister mes offres (paginé)",
            description = "Offres des companies dont le compte est membre (tous statuts), les plus récentes en premier. "
                    + "Taille de page décidée par le backend (défaut 20, max 50) et renvoyée dans l'enveloppe (D34). "
                    + "Lignes légères : la description et les listes enfants ne sont servies que par le détail.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page renvoyée (vide si aucune)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur pour ce compte")
    })
    ResponseEntity<JobOfferPageResponse> listMine(
            @Parameter(description = "Index de page (0-based)") @RequestParam(name = "page", required = false) Integer page,
            @Parameter(description = "Taille de page (défaut 20, max 50) — valeur effective renvoyée dans la réponse") @RequestParam(name = "size", required = false) Integer size,
            Authentication authentication);

    @GetMapping("/{offerId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire une offre", description = "Réservée aux membres de la company ; un compte non-membre reçoit le même 404 qu'une offre inexistante (aucune fuite d'existence).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Offre renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible")
    })
    ResponseEntity<JobOfferResponse> get(@PathVariable UUID offerId, Authentication authentication);

    @PutMapping("/{offerId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Modifier une offre", description = "Owner de la company ou recruteur créateur, uniquement en DRAFT ou VALIDATED (dirty-flag). Les listes remplacent intégralement l'existant.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Offre modifiée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide ou référence de vocabulaire inconnue"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut PUBLISHED ou CLOSED (lecture seule)")
    })
    ResponseEntity<Void> update(@PathVariable UUID offerId, @Valid @RequestBody UpdateJobOfferRequest request,
            Authentication authentication);

    @DeleteMapping("/{offerId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Supprimer une offre", description = "Owner ou créateur, DRAFT uniquement : la suppression nettoie les associations.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Offre supprimée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut autre que DRAFT")
    })
    ResponseEntity<Void> delete(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/{offerId}/duplicate")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Dupliquer une offre", description = "Membre de la company, tous statuts : copie le contenu en une nouvelle offre DRAFT attribuée au duplicateur (titre suffixé « (copy) », expiry réinitialisée, nouvel identifiant public).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Copie créée en DRAFT"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Aucun profil recruteur, offre inexistante ou inaccessible")
    })
    ResponseEntity<JobOfferResponse> duplicate(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/{offerId}/validate")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Valider une offre", description = "Owner ou créateur ; DRAFT → VALIDATED (re-validation autorisée). La validation déclenche la normalisation (étape 3) — elle ne publie pas (D13).")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Offre validée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut PUBLISHED ou CLOSED")
    })
    ResponseEntity<Void> validate(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/{offerId}/revalidate")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(
            summary = "Rafraîchir l'analyse d'une offre publiée",
            description = "Owner ou créateur ; PUBLISHED uniquement, sans changement "
                    + "de cycle de vie. Crée une nouvelle version de fiche normalisée si "
                    + "l'analyse est obsolète ou en échec ; no-op sinon.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Analyse rafraîchie ou déjà à jour"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut autre que PUBLISHED")
    })
    ResponseEntity<Void> revalidate(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/{offerId}/publish")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Publier une offre", description = "Owner ou créateur ; VALIDATED → PUBLISHED uniquement (D13 : validate ≠ publish).")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Offre publiée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut autre que VALIDATED")
    })
    ResponseEntity<Void> publish(@PathVariable UUID offerId, Authentication authentication);

    @PostMapping("/{offerId}/close")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Clôturer une offre", description = "Owner ou créateur ; VALIDATED ou PUBLISHED → CLOSED.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Offre clôturée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits d'écriture sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou inaccessible"),
            @ApiResponse(responseCode = "409", description = "Statut DRAFT ou CLOSED")
    })
    ResponseEntity<Void> close(@PathVariable UUID offerId, Authentication authentication);
}
