package com.linqorbit.joboffer.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.joboffer.dto.PublicJobListItem;
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
    @Operation(summary = "Lister les offres publiées (paginé, recherche, filtres, tri)", description = "Sans authentification. Seules les offres publiées et non expirées — les filtres ne peuvent jamais élargir ce périmètre. Par défaut de la plus récente publication à la plus ancienne ; enveloppe {items, page, size, total} (total = total filtré), la taille de page est décidée par le backend. Tous les paramètres sont facultatifs : absent ou vide = pas de filtre. Pays, séniorité ou tri invalides : 400.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page d'offres publiées renvoyée"),
            @ApiResponse(responseCode = "400", description = "Pays, séniorité, tri ou identifiant invalide")
    })
    ResponseEntity<PublicJobPageResponse> listJobs(
            @RequestParam(required = false) Integer page,
            @Parameter(description = "Recherche sur le titre ou le nom de la société (insensible à la casse, 100 caractères au plus)") @RequestParam(name = "q", required = false) String q,
            @Parameter(description = "Mode de travail (id du vocabulaire)") @RequestParam(name = "workModeId", required = false) UUID workModeId,
            @Parameter(description = "Type de contrat (id du vocabulaire)") @RequestParam(name = "contractTypeId", required = false) UUID contractTypeId,
            @Parameter(description = "Type d'emploi (id du vocabulaire)") @RequestParam(name = "employmentTypeId", required = false) UUID employmentTypeId,
            @Parameter(description = "Séniorité : junior, mid, senior, lead ou principal") @RequestParam(name = "seniority", required = false) String seniority,
            @Parameter(description = "Pays : code ISO 3166-1 alpha-2 (ex. FR), casse ignorée") @RequestParam(name = "country", required = false) String country,
            @Parameter(description = "Tri : recent (défaut) ou expiringSoon (échéance la plus proche, sans échéance en dernier)") @RequestParam(name = "sort", required = false) String sort);

    @GetMapping("/{publicId}")
    @Operation(summary = "Lire une offre publiée", description = "Sans authentification. 404 pour toute offre inconnue, non publiée, clôturée ou expirée — le même détail évite d'énumérer les offres existantes.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Offre publiée renvoyée"),
            @ApiResponse(responseCode = "404", description = "Offre inconnue, non publiée, clôturée ou expirée")
    })
    ResponseEntity<PublicJobResponse> getJob(@PathVariable String publicId);

    @GetMapping("/{publicId}/related")
    @Operation(summary = "Autres offres de la même entreprise", description = "Sans authentification. Endpoint séparé de la fiche : les autres offres publiées et non expirées de la même entreprise (l'offre courante exclue), de la plus récente à la plus ancienne, bornées par le backend — liste vide si l'entreprise n'a pas d'autre ouverture. 404 si l'offre de référence est inconnue, non publiée, clôturée ou expirée.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autres offres de l'entreprise renvoyées (liste possiblement vide)"),
            @ApiResponse(responseCode = "404", description = "Offre de référence inconnue, non publiée, clôturée ou expirée")
    })
    ResponseEntity<List<PublicJobListItem>> listRelatedJobs(@PathVariable String publicId);
}
