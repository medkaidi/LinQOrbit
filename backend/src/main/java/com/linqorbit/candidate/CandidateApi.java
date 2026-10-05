package com.linqorbit.candidate;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.candidate.dto.AboutRequest;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.DegreeOption;
import com.linqorbit.candidate.dto.DiplomaRequest;
import com.linqorbit.candidate.dto.ExperienceRequest;
import com.linqorbit.candidate.dto.LanguageOption;
import com.linqorbit.candidate.dto.LanguageRequest;
import com.linqorbit.candidate.dto.LinkRequest;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillRequest;
import com.linqorbit.candidate.dto.StudyFieldOption;
import com.linqorbit.candidate.dto.TargetPositionRequest;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API du profil candidat : définit les endpoints et leur documentation
 * OpenAPI. Implémenté par {@link CandidateController}.
 */
@Tag(name = "Candidate profile", description = "Profil professionnel du candidat connecté")
public interface CandidateApi {

    @GetMapping("/me/profile")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lire le profil candidat", description = "Vue agrégée du profil (6 sections) avec le taux de complétion. Renvoie un profil vide si le candidat n'a encore rien renseigné.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profil renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<CandidateProfileResponse> getProfile(Authentication authentication);

    @PutMapping("/me/profile/about")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Mettre à jour la section À propos", description = "Titre, bio, années d'expérience et statut de recherche. Crée le profil candidat s'il n'existe pas encore.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateAbout(@Valid @RequestBody AboutRequest request, Authentication authentication);

    @PutMapping("/me/profile/about/target-position")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Mettre à jour le poste recherché", description = "Champ isolé du bloc About, utilisé par la carte identité : le PUT /about ne l'écrit jamais. Valeur nulle ou vide efface le poste recherché. Crée le profil candidat s'il n'existe pas encore.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Poste recherché enregistré"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateTargetPosition(@Valid @RequestBody TargetPositionRequest request,
            Authentication authentication);

    @PutMapping("/me/profile/experiences")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Remplacer les expériences professionnelles", description = "Le tableau reçu remplace intégralement la liste existante, dans l'ordre fourni.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateExperiences(@Valid @RequestBody List<ExperienceRequest> request,
            Authentication authentication);

    @PutMapping("/me/profile/diplomas")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Remplacer les diplômes", description = "Le tableau reçu remplace intégralement la liste existante, dans l'ordre fourni.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateDiplomas(@Valid @RequestBody List<DiplomaRequest> request,
            Authentication authentication);

    @PutMapping("/me/profile/skills")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Remplacer les compétences", description = "Le tableau reçu remplace intégralement la liste existante. Les compétences doivent appartenir à la liste prédéfinie.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateSkills(@Valid @RequestBody List<SkillRequest> request, Authentication authentication);

    @PutMapping("/me/profile/languages")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Remplacer les langues", description = "Le tableau reçu remplace intégralement la liste existante. Les langues doivent appartenir à la liste prédéfinie, niveau CECR de A1 à C2.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateLanguages(@Valid @RequestBody List<LanguageRequest> request,
            Authentication authentication);

    @PutMapping("/me/profile/links")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Remplacer les liens et certifications", description = "Le tableau reçu remplace intégralement la liste existante. issuer et issuedAt ne sont acceptés que pour un lien de type certification.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Section enregistrée"),
            @ApiResponse(responseCode = "400", description = "Corps invalide (validation Bean Validation ou règle métier)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<Void> updateLinks(@Valid @RequestBody List<LinkRequest> request, Authentication authentication);

    @PostMapping(value = "/me/profile/cv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Analyser un CV importé", description = "Upload d'un PDF envoyé au service IA : titre, résumé, expériences, diplômes, compétences, langues et liens. Rien n'est enregistré : le client prévisualise puis applique les champs retenus.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Extraction structurée renvoyée (rien n'est enregistré)"),
            @ApiResponse(responseCode = "400", description = "Fichier vide ou illisible"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "413", description = "Fichier trop volumineux (5 Mo maximum)"),
            @ApiResponse(responseCode = "415", description = "Type de fichier non supporté (PDF uniquement)"),
            @ApiResponse(responseCode = "422", description = "Aucun texte extractible dans le PDF (scan)"),
            @ApiResponse(responseCode = "429", description = "Quota du service IA atteint, réessayer plus tard"),
            @ApiResponse(responseCode = "502", description = "Le service IA n'a pas produit de structure valide"),
            @ApiResponse(responseCode = "504", description = "Service IA injoignable ou délai dépassé")
    })
    ResponseEntity<CvParseResponse> parseCv(@RequestPart("file") MultipartFile file);

    @GetMapping("/reference/skills")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Liste des compétences", description = "Vocabulaire prédéfini des compétences, techniques puis comportementales, par nom.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<SkillOption>> getSkills();

    @GetMapping("/reference/languages")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Liste des langues", description = "Vocabulaire prédéfini des langues (symboles ISO 639-1) par nom.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<LanguageOption>> getLanguages();

    @GetMapping("/reference/degrees")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Liste des niveaux de diplôme", description = "Vocabulaire prédéfini des niveaux de diplôme par libellé.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<DegreeOption>> getDegrees();

    @GetMapping("/reference/study-fields")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Liste des domaines d'étude", description = "Vocabulaire prédéfini des domaines d'étude par libellé.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Liste renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré")
    })
    ResponseEntity<List<StudyFieldOption>> getStudyFields();
}
