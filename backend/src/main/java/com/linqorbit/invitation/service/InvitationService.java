package com.linqorbit.invitation.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.invitation.dto.SuggestedCandidateCard;
import com.linqorbit.invitation.entity.OfferCandidate;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.exception.InvalidInvitationException;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.service.JobOfferService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Invitation d'un candidat suggéré à candidater (T-101, D85 ; consentement T-102, D86). Acte de
 * gestion : owner de la company ou recruteur créateur de l'offre (D12 —
 * {@code JobOfferService.getForManagement} : 404 hors company, 403 sinon).
 *
 * <p>L'invitation est une <b>information tirée</b> (le candidat la voit dans
 * « My applications ») : aucune notification poussée, aucun matching IA —
 * celui-ci ne démarre que lorsque le candidat candidate lui-même (D58/D59).
 * Passage {@code SUGGESTED → INVITED} par UPDATE conditionnel : deux
 * recruteurs qui invitent en même temps n'ont qu'un vainqueur, l'autre reçoit
 * un 409 (jamais une 500). La <b>visibilité du candidat</b> (consentement et
 * recherche active, D98) est contrôlée dans ce même UPDATE : une invitation
 * n'est jamais écrite pour une personne déjà invisible, et un CAS refusé est
 * ensuite qualifié par sa vraie cause (404 si plus visible, 409 sinon).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InvitationService {

    private final JobOfferService jobOfferService;
    private final OfferCandidateRepository offerCandidateRepository;
    private final ApplicationRepository applicationRepository;
    private final SuggestedCandidateService suggestedCandidateService;

    @Transactional
    public SuggestedCandidateCard invite(UUID userId, UUID offerId, UUID suggestionId) {
        JobOffer offer = jobOfferService.getForManagement(userId, offerId);
        SuggestedCandidateService.requireOpen(offer);
        OfferCandidate row = suggestedCandidateService.requireVisible(userId, offerId, suggestionId);
        if (applicationRepository.findByCandidateIdAndJobOfferId(row.getCandidateId(), offerId).isPresent()) {
            log.warn("Invitation rejected : candidate already applied, offerId={}, suggestionId={}", offerId,
                    suggestionId);
            throw new InvalidInvitationException(HttpStatus.CONFLICT,
                    "This candidate has already applied to the offer.");
        }
        if (row.getStatus() == OfferCandidateStatus.INVITED) {
            throw alreadyInvited(offerId, suggestionId);
        }
        LocalDateTime now = LocalDateTime.now();
        int invited = offerCandidateRepository.casInvite(suggestionId, offerId, userId,
                (short) OfferCandidateStatus.SUGGESTED.getCode(), (short) OfferCandidateStatus.INVITED.getCode(),
                now, SearchStatus.NOT_LOOKING.getCode());
        if (invited != 1) {
            throw refusedInvitation(userId, offerId, suggestionId);
        }
        log.info("Candidate invited : offerId={}, suggestionId={}, invitedBy={}", offerId, suggestionId, userId);
        row.setStatus(OfferCandidateStatus.INVITED);
        return suggestedCandidateService.card(row, false);
    }

    /**
     * Cause réelle d'un CAS qui n'a rien écrit, dans l'ordre : ligne disparue (404), candidat devenu
     * invisible entre la relecture et l'écriture (404 identique à une suggestion inconnue — jamais le
     * 409 « already invited »), déjà invité ou autre état concurrent (409).
     */
    private InvalidInvitationException refusedInvitation(UUID userId, UUID offerId, UUID suggestionId) {
        OfferCandidate current = offerCandidateRepository.findByIdAndJobOfferId(suggestionId, offerId).orElse(null);
        if (current == null || !suggestedCandidateService.isVisible(current)) {
            log.warn("Invitation rejected : suggestion gone or candidate no longer visible, offerId={}, "
                    + "suggestionId={}, userId={}", offerId, suggestionId, userId);
            return new InvalidInvitationException(HttpStatus.NOT_FOUND, SuggestedCandidateService.NOT_FOUND);
        }
        return alreadyInvited(offerId, suggestionId);
    }

    private static InvalidInvitationException alreadyInvited(UUID offerId, UUID suggestionId) {
        log.warn("Invitation rejected : already invited, offerId={}, suggestionId={}", offerId, suggestionId);
        return new InvalidInvitationException(HttpStatus.CONFLICT,
                "This candidate has already been invited.");
    }
}
