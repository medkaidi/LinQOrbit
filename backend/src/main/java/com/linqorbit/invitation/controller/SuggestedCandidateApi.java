package com.linqorbit.invitation.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.invitation.dto.SuggestedCandidateCard;
import com.linqorbit.invitation.dto.SuggestedCandidateProfileResponse;
import com.linqorbit.invitation.dto.SuggestedCandidatesResponse;

/**
 * Contrat d'API des candidats suggérés d'une offre publiée et de leur
 * invitation (T-101, D85). Implémenté par {@link SuggestedCandidateController}.
 */
@Tag(name = "Suggested candidates", description = "Candidats suggérés (ayant consenti à la visibilité de leur profil) par la recherche automatique d'une offre, profil complet et invitation à candidater")
public interface SuggestedCandidateApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les candidats suggérés d'une offre",
            description = "Membre de la company de l'offre. Résultat figé de la recherche faite à la publication, dans l'ordre du screening, en cartes (nom, poste, séniorité, années, pays, compétences) — uniquement les candidats qui ont consenti (relu à chaque lecture : un retrait masque aussitôt la carte), jamais d'identifiant de candidat, d'e-mail ni de téléphone. canInvite = droit de gestion D12. Statut d'une carte : suggested, invited ou applied (candidature existante).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée (éventuellement vide)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre inexistante ou hors des companies du recruteur"),
            @ApiResponse(responseCode = "409", description = "Offre non publiée ou expirée")
    })
    ResponseEntity<SuggestedCandidatesResponse> list(@PathVariable UUID offerId, Authentication authentication);

    @GetMapping("/{suggestionId}/profile")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire le profil complet d'un candidat suggéré", description = "Membre de la company de l'offre. Profil professionnel complet et nom du candidat qui a consenti (T-102, D86) ; jamais d'e-mail ni de téléphone (le contact passe par l'invitation). canInvite = droit de gestion D12. Consentement retiré : 404.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profil renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre ou suggestion inconnue, hors des companies du recruteur, ou consentement retiré"),
            @ApiResponse(responseCode = "409", description = "Offre non publiée ou expirée")
    })
    ResponseEntity<SuggestedCandidateProfileResponse> profile(@PathVariable UUID offerId,
            @PathVariable UUID suggestionId, Authentication authentication);

    @PostMapping("/{suggestionId}/invitations")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Inviter un candidat suggéré à candidater",
            description = "Owner de la company ou créateur de l'offre (D12). SUGGESTED → INVITED. Le candidat voit l'invitation dans « My applications » ; aucune notification, aucun matching IA tant qu'il n'a pas candidaté.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Invitation créée, carte mise à jour"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Membre sans droits de gestion sur l'offre"),
            @ApiResponse(responseCode = "404", description = "Offre ou suggestion inconnue, hors des companies du recruteur, ou consentement du candidat retiré"),
            @ApiResponse(responseCode = "409", description = "Offre non publiée ou expirée, candidat déjà invité ou ayant déjà candidaté")
    })
    ResponseEntity<SuggestedCandidateCard> invite(@PathVariable UUID offerId, @PathVariable UUID suggestionId,
            Authentication authentication);
}
