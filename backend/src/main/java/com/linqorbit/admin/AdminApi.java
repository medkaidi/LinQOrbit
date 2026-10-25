package com.linqorbit.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.admin.dto.AdminCriterionReportDetailResponse;
import com.linqorbit.admin.dto.AdminCriterionReportPageResponse;
import com.linqorbit.admin.dto.AdminCriterionReportReviewResponse;
import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserPageResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.ApproveSkillSuggestionRequest;
import com.linqorbit.admin.dto.CreateCriterionReportReviewRequest;
import com.linqorbit.admin.dto.LinkSkillSuggestionRequest;
import com.linqorbit.admin.dto.UpdateUserStatusRequest;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.config.OpenApiConfig;

/**
 * Contrat d'API d'administration : comptes (liste, détail, statut, fiche
 * normalisée), offres globales (liste paginée, détail, fiche normalisée) et
 * file de suggestions de compétences. Implémenté par {@link AdminController},
 * protégé par le rôle ADMIN (SecurityConfig).
 */
@Tag(name = "Admin", description = "Administration : comptes, offres globales et suggestions de compétences (rôle ADMIN)")
public interface AdminApi {

    @GetMapping("/users")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les comptes (paginé)",
            description = "Tous les comptes avec statut, rôles de capacité et drapeaux candidat / recruteur, triés par nom. "
                    + "Filtres optionnels : recherche `q` (prénom, nom ou email), `status` (active | inactive) et "
                    + "`capability` (candidate | recruiter — identité de profil). "
                    + "Pagination (défaut 20, max 50 — D34) : la taille effective est renvoyée dans l'enveloppe.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page de comptes renvoyée"),
            @ApiResponse(responseCode = "400", description = "Filtre de statut ou de capacité non supporté"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<AdminUserPageResponse> listUsers(
            @Parameter(description = "Recherche prénom / nom / email (LIKE, insensible à la casse)") @RequestParam(name = "q", required = false) String q,
            @Parameter(description = "Filtre de statut : active | inactive") @RequestParam(name = "status", required = false) String status,
            @Parameter(description = "Filtre de capacité : candidate | recruiter") @RequestParam(name = "capability", required = false) String capability,
            @Parameter(description = "Index de page (0-based)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Taille de page (défaut 20, max 50) — valeur effective renvoyée dans la réponse") @RequestParam(name = "size", required = false) Integer size);

    @GetMapping("/users/{userId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter un compte", description = "Fiche détail : identité complète saisie par l'utilisateur (jamais le hash du mot de passe), statut, rôles et drapeaux candidat / recruteur.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Compte renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable")
    })
    ResponseEntity<AdminUserDetailResponse> getUserDetail(@PathVariable("userId") UUID userId);

    @GetMapping("/users/{userId}/profile")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter le profil professionnel d'un candidat",
            description = "Même forme que le profil du candidat connecté (lecture seule, jamais d'écriture) : sections du profil, pourcentage de complétion et signaux de normalisation (D38). 404 si le compte n'existe pas ou n'est pas un candidat.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profil renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable ou sans profil candidat")
    })
    ResponseEntity<CandidateProfileResponse> getCandidateProfile(@PathVariable("userId") UUID userId);

    @GetMapping("/users/{userId}/normalized-profile")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter la fiche normalisée d'un candidat",
            description = "Dernière version de l'objet canonique du candidat (schéma v2) + statut du job de normalisation. 404 si le compte n'est pas un candidat ou si aucune validation n'a encore produit de fiche.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fiche normalisée renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable ou aucune fiche normalisée")
    })
    ResponseEntity<AdminNormalizedProfileResponse> getCandidateNormalizedProfile(
            @PathVariable("userId") UUID userId);

    @GetMapping("/users/{userId}/normalized-profile/versions")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter l'historique des fiches normalisées d'un candidat",
            description = "Toutes les versions produites de l'objet canonique du candidat, de la plus récente à la plus ancienne, avec statut de job et contenu de chaque version (D37). 404 si le compte n'est pas un candidat ou si aucune validation n'a encore produit de fiche.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Historique renvoyé (liste vide impossible)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable ou aucune fiche normalisée")
    })
    ResponseEntity<List<AdminNormalizedProfileResponse>> getCandidateNormalizedProfileVersions(
            @PathVariable("userId") UUID userId);

    @GetMapping("/job-offers")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister toutes les offres du système",
            description = "Vue globale de toutes les offres, tri createdAt décroissant, pagination (défaut 20, max 50 — D34). Filtres facultatifs combinés en ET (absent, vide ou blanc = pas de filtre) : statut (draft|validated|published|closed), recherche q sur le titre ou le nom de la société (100 caractères au plus, % et _ littéraux), mode de travail, contrat, type d'emploi, séniorité, échéance (expired|expiringSoon).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page d'offres renvoyée"),
            @ApiResponse(responseCode = "400", description = "Filtre de statut, de séniorité ou d'échéance non supporté"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<AdminJobOfferPageResponse> listJobOffers(
            @Parameter(description = "Recherche sur le titre ou le nom de la société") @RequestParam(name = "q", required = false) String q,
            @Parameter(description = "Filtre de statut d'offre") @RequestParam(name = "status", required = false) String status,
            @Parameter(description = "Mode de travail (identifiant du vocabulaire)") @RequestParam(name = "workModeId", required = false) UUID workModeId,
            @Parameter(description = "Type de contrat (identifiant du vocabulaire)") @RequestParam(name = "contractTypeId", required = false) UUID contractTypeId,
            @Parameter(description = "Type d'emploi (identifiant du vocabulaire)") @RequestParam(name = "employmentTypeId", required = false) UUID employmentTypeId,
            @Parameter(description = "Séniorité") @RequestParam(name = "seniority", required = false) String seniority,
            @Parameter(description = "Échéance : expired | expiringSoon (≤ 30 jours)") @RequestParam(name = "expiry", required = false) String expiry,
            @Parameter(description = "Index de page (0-based)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Taille de page (défaut 20, max 50) — valeur effective renvoyée dans la réponse") @RequestParam(name = "size", required = false) Integer size);

    @GetMapping("/job-offers/{offerId}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter une offre",
            description = "Fiche publique (labels résolus, HTML sanitisé) sans gate published / non expirée, augmentée de l'identifiant, du statut de vie et des horodatages. Lecture seule, tous statuts.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Offre renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Offre introuvable")
    })
    ResponseEntity<AdminJobOfferDetailResponse> getJobOfferDetail(@PathVariable("offerId") UUID offerId);

    @GetMapping("/job-offers/{offerId}/normalized-profile")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter la fiche normalisée d'une offre",
            description = "Dernière version de l'objet canonique de l'offre (schéma v1) + statut du job de normalisation. 404 si l'offre n'existe pas ou si aucune validation n'a encore produit de fiche.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fiche normalisée renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Offre introuvable ou aucune fiche normalisée")
    })
    ResponseEntity<AdminNormalizedProfileResponse> getOfferNormalizedProfile(@PathVariable("offerId") UUID offerId);

    @GetMapping("/job-offers/{offerId}/normalized-profile/versions")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter l'historique des fiches normalisées d'une offre",
            description = "Toutes les versions produites de l'objet canonique de l'offre, de la plus récente à la plus ancienne, avec statut de job et contenu de chaque version (D37). 404 si l'offre n'existe pas ou si aucune validation n'a encore produit de fiche.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Historique renvoyé (liste vide impossible)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Offre introuvable ou aucune fiche normalisée")
    })
    ResponseEntity<List<AdminNormalizedProfileResponse>> getOfferNormalizedProfileVersions(
            @PathVariable("offerId") UUID offerId);

    @PatchMapping("/users/{userId}/status")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Activer ou désactiver un compte", description = "Passe le statut à ACTIVE ou INACTIVE (SUSPENDED refusé ici). Refuse de modifier le propre compte de l'administrateur. Un compte inactif ne peut plus se connecter.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Statut mis à jour"),
            @ApiResponse(responseCode = "400", description = "Statut non supporté ou tentative d'auto-modification"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Compte introuvable")
    })
    ResponseEntity<Void> updateUserStatus(@PathVariable("userId") UUID userId,
            @Valid @RequestBody UpdateUserStatusRequest request, Authentication authentication);

    @GetMapping("/skill-suggestions")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les suggestions de compétences", description = "File de revue : noms proposés par les candidats, absents du catalogue, du plus récent au plus ancien.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Suggestions renvoyées"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<List<AdminSkillSuggestionResponse>> listSkillSuggestions();

    @PostMapping("/skill-suggestions/{id}/approve")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Approuver une suggestion de compétence",
            description = "Crée la compétence dans le catalogue (catégorie existante + type tech/soft), l'ajoute au profil au niveau 1 de chaque auteur de suggestions homonymes et retire tout le groupe de la file.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion approuvée"),
            @ApiResponse(responseCode = "400", description = "Catégorie inconnue ou type invalide"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> approveSkillSuggestion(@PathVariable("id") UUID id,
            @Valid @RequestBody ApproveSkillSuggestionRequest request, Authentication authentication);

    @PostMapping("/skill-suggestions/{id}/link")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Relier une suggestion à une compétence existante",
            description = "Branche le skill catalogue choisi dans le profil au niveau 1 de chaque auteur de suggestions homonymes et retire tout le groupe de la file. Ni création ni suppression dans le catalogue.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion reliée"),
            @ApiResponse(responseCode = "400", description = "Compétence inconnue"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> linkSkillSuggestion(@PathVariable("id") UUID id,
            @Valid @RequestBody LinkSkillSuggestionRequest request, Authentication authentication);

    @PostMapping("/skill-suggestions/{id}/reject")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Rejeter une suggestion de compétence",
            description = "Retire de la file le groupe des suggestions homonymes. Aucun profil touché.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Suggestion rejetée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Suggestion introuvable")
    })
    ResponseEntity<Void> rejectSkillSuggestion(@PathVariable("id") UUID id, Authentication authentication);

    @GetMapping("/criterion-reports")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Lister les signalements internes d'évaluations IA",
            description = "Signalements posés par les recruteurs sur un critère d'une évaluation IA (D66), du plus "
                    + "récent au plus ancien : critère (libellé, section, score et score de section relus dans le "
                    + "résultat épinglé), offre, company, candidat, auteur, motif, commentaire et date. Chaque ligne "
                    + "porte `myReviewVerdict`, le verdict de l'admin courant (null = aucun avis, « Pending » côté "
                    + "UI) : jamais l'avis d'un autre admin, un compteur ou un statut global (T-99). Pagination "
                    + "(défaut 20, max 50).")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page de signalements renvoyée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN")
    })
    ResponseEntity<AdminCriterionReportPageResponse> listCriterionReports(
            @Parameter(description = "Index de page (0-based)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Taille de page (défaut 20, max 50) — valeur effective renvoyée dans la réponse") @RequestParam(name = "size", required = false) Integer size,
            Authentication authentication);

    @GetMapping("/criterion-reports/{id}")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Consulter le dossier d'un signalement interne d'évaluation IA",
            description = "Signalement (motif, commentaire, auteur, date), critère relu dans le résultat épinglé "
                    + "(score, score de section, exigence, justification IA, modèle réellement appelé ou null), "
                    + "évaluation complète en lecture seule, contestations du candidat et écart moyen (D66, D79). "
                    + "Expose uniquement `myReview`, l'avis final de l'admin courant (ou null) : jamais les avis "
                    + "des autres, un compteur ou leur existence. Aucun effet sur le score.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Dossier du signalement renvoyé"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Signalement introuvable")
    })
    ResponseEntity<AdminCriterionReportDetailResponse> getCriterionReport(
            @Parameter(description = "Identifiant du signalement") @PathVariable("id") UUID id,
            Authentication authentication);

    @PostMapping("/criterion-reports/{id}/reviews")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Créer la revue interne d'un signalement IA",
            description = "Avis final et aveugle de l'admin courant sur un signalement (T-96, D77/D78) : un seul "
                    + "avis par admin et par signalement, auto-review interdite, aucune édition ni suppression. "
                    + "Corrections (`correctedScore`, `correctedRationale`) acceptées uniquement pour un verdict "
                    + "`upheld` et facultatives séparément ; aucune moyenne, aucun effet sur le signalement, le "
                    + "résultat, le score ou la décision, aucune notification.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Revue enregistrée"),
            @ApiResponse(responseCode = "400", description = "Verdict, champs ou correction invalides"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "403", description = "Compte sans rôle ADMIN"),
            @ApiResponse(responseCode = "404", description = "Signalement introuvable"),
            @ApiResponse(responseCode = "409", description = "Revue déjà enregistrée ou auto-review interdite")
    })
    ResponseEntity<AdminCriterionReportReviewResponse> createCriterionReportReview(
            @Parameter(description = "Identifiant du signalement") @PathVariable("id") UUID id,
            @Valid @RequestBody CreateCriterionReportReviewRequest request,
            Authentication authentication);
}
