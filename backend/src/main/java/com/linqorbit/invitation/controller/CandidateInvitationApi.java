package com.linqorbit.invitation.controller;

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
import com.linqorbit.invitation.dto.CandidateInvitationResponse;

/**
 * Contrat d'API des invitations reçues par le candidat (T-101, D85).
 * Implémenté par {@link CandidateInvitationController}.
 */
@Tag(name = "Candidate invitations", description = "Invitations à candidater reçues par le candidat connecté")
public interface CandidateInvitationApi {

    @GetMapping
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Mes invitations à candidater",
            description = "Offres encore ouvertes (publiées, non expirées) pour lesquelles un recruteur a invité le candidat et auxquelles il n'a pas encore candidaté, la plus récente d'abord. Tableau brut, vide sans invitation. Information tirée : aucune notification.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Invitations renvoyées (éventuellement aucune)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<CandidateInvitationResponse>> mine(Authentication authentication);
}
