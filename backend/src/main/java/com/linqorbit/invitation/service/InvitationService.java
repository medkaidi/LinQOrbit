package com.linqorbit.invitation.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.application.repository.ApplicationRepository;
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
 * un 409 (jamais une 500).</p>
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
                OfferCandidateStatus.SUGGESTED, OfferCandidateStatus.INVITED, now);
        if (invited != 1) {
            throw alreadyInvited(offerId, suggestionId);
        }
        log.info("Candidate invited : offerId={}, suggestionId={}, invitedBy={}", offerId, suggestionId, userId);
        row.setStatus(OfferCandidateStatus.INVITED);
        return suggestedCandidateService.card(row, false);
    }

    private static InvalidInvitationException alreadyInvited(UUID offerId, UUID suggestionId) {
        log.warn("Invitation rejected : already invited, offerId={}, suggestionId={}", offerId, suggestionId);
        return new InvalidInvitationException(HttpStatus.CONFLICT,
                "This candidate has already been invited.");
    }
}
