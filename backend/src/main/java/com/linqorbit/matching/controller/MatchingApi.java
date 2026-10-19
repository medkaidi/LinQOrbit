package com.linqorbit.matching.controller;

import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import com.linqorbit.config.OpenApiConfig;
import com.linqorbit.matching.dto.AnswerClarificationRequest;
import com.linqorbit.matching.dto.MatchingFeedbackResponse;
import com.linqorbit.matching.dto.MatchingResponse;
import com.linqorbit.matching.dto.SaveMatchingFeedbackRequest;
import com.linqorbit.matching.dto.StartMatchingRequest;

/**
 * Contrat d'API du matching côté candidat (D58–D59) : lancement ou reprise de
 * l'analyse, lecture du résultat courant et suivi SSE (D60), clarifications
 * IA (T-62 : répondre, passer, terminer) et contestation par critère (T-63).
 * Implémenté par {@link MatchingController}.
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

    @PostMapping("/offer/{publicId}/clarifications/{clarificationId}/answer")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Répondre à la question IA ouverte",
            description = "La question passe ANSWERED et une réévaluation démarre (nouvelle version de résultat liée à la réponse, analyse asynchrone suivie par le flux SSE) ; la question suivante, ou la fin d'évaluation, arrive avec le résultat.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Réponse enregistrée, réévaluation lancée"),
            @ApiResponse(responseCode = "400", description = "Réponse vide ou trop longue (3000 caractères)"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible, aucun matching ou question inconnue"),
            @ApiResponse(responseCode = "409", description = "Question déjà fermée, analyse en cours ou candidature transmise")
    })
    ResponseEntity<MatchingResponse> answerClarification(@PathVariable String publicId,
            @PathVariable UUID clarificationId, @Valid @RequestBody AnswerClarificationRequest request,
            Authentication authentication);

    @PostMapping("/offer/{publicId}/clarifications/{clarificationId}/skip")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Passer la question IA ouverte",
            description = "La question passe SKIPPED (elle consomme un cran du plafond de l'offre) et une réévaluation démarre ; l'agent visera une autre lacune.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Question passée, réévaluation lancée"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible, aucun matching ou question inconnue"),
            @ApiResponse(responseCode = "409", description = "Question déjà fermée, analyse en cours ou candidature transmise")
    })
    ResponseEntity<MatchingResponse> skipClarification(@PathVariable String publicId,
            @PathVariable UUID clarificationId, Authentication authentication);

    @PostMapping("/offer/{publicId}/assessment/finish")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Terminer l'évaluation",
            description = "Ferme la question ouverte (SKIPPED) et clôt l'évaluation : plus aucune question. Idempotent.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Évaluation close"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible ou aucun matching"),
            @ApiResponse(responseCode = "409", description = "Analyse en cours ou candidature transmise")
    })
    ResponseEntity<Void> finishAssessment(@PathVariable String publicId, Authentication authentication);

    @PutMapping("/offer/{publicId}/feedback")
    @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
    @Operation(summary = "Enregistrer la contestation par critère",
            description = "Remplacement complet sur le dernier résultat terminé : score propre 0–100 et commentaire facultatif par critère ; items absents supprimés, liste vide = tout effacer. Ne modifie jamais les scores. Modifiable jusqu'à la transmission de la candidature.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contestations enregistrées"),
            @ApiResponse(responseCode = "400", description = "Score hors 0–100, critère inconnu ou dupliqué, commentaire trop long"),
            @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré"),
            @ApiResponse(responseCode = "404", description = "Offre indisponible ou aucun matching"),
            @ApiResponse(responseCode = "409", description = "Évaluation non close, question ouverte, analyse en cours ou candidature transmise")
    })
    ResponseEntity<MatchingFeedbackResponse> saveFeedback(@PathVariable String publicId,
            @Valid @RequestBody SaveMatchingFeedbackRequest request, Authentication authentication);
}
