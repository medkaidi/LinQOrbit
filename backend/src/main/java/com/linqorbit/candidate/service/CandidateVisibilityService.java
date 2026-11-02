package com.linqorbit.candidate.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.candidate.dto.VisibilityConsentResponse;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.exception.VisibilityConsentException;
import com.linqorbit.candidate.repository.CandidateRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Consentement du candidat à la visibilité de son profil complet par les
 * recruteurs (T-102, D86). Opt-in : sans consentement, le candidat n'est ni
 * proposé par le screening ni listé. Le serveur pose la date et la version du
 * texte ({@link #CONSENT_VERSION}) ; le retrait remet les deux à {@code NULL}
 * et masque aussitôt le profil des listes déjà calculées (le filtre est relu
 * à chaque lecture). Idempotent : un nouvel accord conserve la date d'origine.
 *
 * <p>Écriture par UPDATE bulk : le consentement n'est pas une modification du
 * profil et ne doit pas déclencher le dirty-flag de la normalisation.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateVisibilityService {

    /**
     * Version du texte de consentement affiché ; à incrémenter si le texte change.
     * <p>
     * 4 : le texte borne la promesse « pas d'e-mail ni de téléphone » à la
     * <b>surface « profil recommandé »</b> (celle que ce consentement gouverne) et
     * renvoie la candidature à son propre moment de partage — un candidat qui
     * postule à une offre transmet déjà son CV, qui porte ses coordonnées, et
     * le recruteur de cette candidature les reçoit (T-125, D107).
     * <p>
     * 3 : texte identique à la version 1 (e-mail et téléphone jamais visibles du
     * recruteur <i>par la recommandation</i>). La version 2, qui les annonçait
     * sur cette même surface, a été abandonnée avant toute mise en production ;
     * les consentements v2 de la base de dev couvrent un périmètre plus large que
     * le texte actuel et restent donc valables.
     * <p>
     * Les consentements v3 restent valables : l'accès qu'ils autorisent
     * (recommandation de leur profil, sans coordonnées) est inchangé — le
     * partage des coordonnées d'une candidature ne dépend pas de ce
     * consentement. Seul un consentement dont le périmètre ne couvre pas le texte
     * courant est annulé (V31 pour la version 1).
     */
    public static final short CONSENT_VERSION = 4;

    static final String NO_PROFILE = "Add some information to your profile before sharing it with recruiters.";

    private final CandidateRepository candidateRepository;

    @Transactional(readOnly = true)
    public VisibilityConsentResponse get(UUID userId) {
        return candidateRepository.findById(userId).map(CandidateVisibilityService::toResponse)
                .orElseGet(() -> new VisibilityConsentResponse(false, null));
    }

    @Transactional
    public VisibilityConsentResponse set(UUID userId, boolean consent) {
        Candidate candidate = candidateRepository.findById(userId).orElseThrow(() -> {
            log.warn("Recruiter visibility consent rejected : no candidate profile, userId={}", userId);
            return new VisibilityConsentException(NO_PROFILE);
        });
        boolean already = candidate.getRecruiterVisibilityConsentAt() != null;
        if (already == consent) {
            log.info("Recruiter visibility consent unchanged : userId={}, consent={}", userId, consent);
            return toResponse(candidate);
        }
        LocalDateTime consentedAt = consent ? LocalDateTime.now() : null;
        candidateRepository.updateRecruiterVisibilityConsent(userId, consentedAt,
                consent ? CONSENT_VERSION : null);
        log.info("Recruiter visibility consent changed : userId={}, consent={}, version={}", userId, consent,
                consent ? CONSENT_VERSION : null);
        return new VisibilityConsentResponse(consent, consentedAt);
    }

    private static VisibilityConsentResponse toResponse(Candidate candidate) {
        LocalDateTime at = candidate.getRecruiterVisibilityConsentAt();
        return new VisibilityConsentResponse(at != null, at);
    }
}
