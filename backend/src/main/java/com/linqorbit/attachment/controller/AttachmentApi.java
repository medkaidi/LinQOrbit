package com.linqorbit.attachment.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.linqorbit.attachment.dto.AttachmentResponse;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API des pièces jointes candidat : CV déposés, listés, téléchargés,
 * sélectionnés comme CV courant et supprimés. Implémenté par
 * {@link AttachmentController}.
 */
@Tag(name = "Candidate attachments", description = "CV stockés du candidat connecté")
public interface AttachmentApi {

    @PostMapping(value = "/me/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Téléverser un CV",
            description = "Dépose un PDF (5 Mo maximum) qui devient le CV courant. Crée le profil candidat s'il n'existe pas encore. Les CV précédents sont conservés et restent téléchargeables.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "CV enregistré et devenu courant"),
            @ApiResponse(responseCode = "400", description = "Fichier vide ou nom de fichier trop long"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "413", description = "Fichier trop volumineux (5 Mo maximum)"),
            @ApiResponse(responseCode = "415", description = "Type de fichier non supporté (PDF uniquement)")
    })
    ResponseEntity<AttachmentResponse> upload(@RequestPart("file") MultipartFile file,
            Authentication authentication);

    @GetMapping("/me/attachments")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister mes CV",
            description = "CV du candidat connecté, du plus récent au plus ancien, avec le drapeau du CV courant.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<AttachmentResponse>> list(Authentication authentication);

    @GetMapping("/me/attachments/{attachmentId}/content")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Télécharger un CV",
            description = "Flux PDF du CV demandé. L'identifiant d'un autre candidat est introuvable (404).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Flux du fichier (PDF)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "CV inconnu pour ce candidat")
    })
    ResponseEntity<Resource> download(@PathVariable UUID attachmentId, Authentication authentication);

    @PutMapping("/me/attachments/{attachmentId}/current")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Définir le CV courant",
            description = "Désigne le CV utilisé par les prochaines candidatures sans modifier le profil.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "CV courant mis à jour"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "CV inconnu pour ce candidat")
    })
    ResponseEntity<Void> setCurrent(@PathVariable UUID attachmentId, Authentication authentication);

    @DeleteMapping("/me/attachments/{attachmentId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Supprimer un CV",
            description = "Supprime le CV et son fichier. S'il était le CV courant, le pointeur est remis à vide. "
                    + "Un CV joint à une candidature transmise ne se supprime pas (409) ; celui d'un brouillon en "
                    + "est détaché (la transmission reprendra le CV courant).")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "CV supprimé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "CV inconnu pour ce candidat"),
            @ApiResponse(responseCode = "409", description = "CV joint à une candidature transmise")
    })
    ResponseEntity<Void> delete(@PathVariable UUID attachmentId, Authentication authentication);
}
