package com.linqorbit.invitation.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.invitation.dto.SuggestedCandidateCard;
import com.linqorbit.invitation.dto.SuggestedCandidateProfileResponse;
import com.linqorbit.invitation.dto.SuggestedCandidatesResponse;
import com.linqorbit.invitation.entity.OfferCandidate;
import com.linqorbit.invitation.exception.InvalidInvitationException;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Candidats suggérés d'une offre publiée, vus par le recruteur (T-101, D85) :
 * le résultat <b>figé</b> du screening (table {@code offer_candidate}), jamais
 * recalculé à la lecture. Les candidats ont consenti à la visibilité de leur
 * profil complet (T-102, D86) ; le consentement est <b>relu à chaque
 * lecture</b> : le Top N est un instantané, un retrait masque aussitôt la
 * personne (liste et détail), sans toucher à l'instantané. Lecture ouverte à
 * tout membre de la company (404 sûr sinon) ; {@code canInvite} porte le droit
 * de gestion D12. Offre non publiée ou expirée : 409.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SuggestedCandidateService {

    static final String OFFER_NOT_OPEN = "Candidates can only be suggested for a published offer.";
    static final String NOT_FOUND = "Suggested candidate not found.";

    private final JobOfferService jobOfferService;
    private final OfferCandidateRepository offerCandidateRepository;
    private final NormalizedProfileRepository normalizedProfileRepository;
    private final CandidateRepository candidateRepository;
    private final UserRepository userRepository;
    private final CandidateService candidateService;
    private final CandidateCardAnonymizer anonymizer;

    @Transactional(readOnly = true)
    public SuggestedCandidatesResponse list(UUID userId, UUID offerId) {
        JobOffer offer = jobOfferService.getForMember(userId, offerId);
        requireOpen(offer);
        boolean canInvite = jobOfferService.canManage(userId, offer);

        List<OfferCandidate> rows = offerCandidateRepository.findByJobOfferIdOrderByRankAscIdAsc(offerId);
        if (rows.isEmpty()) {
            return new SuggestedCandidatesResponse(canInvite, List.of());
        }
        List<UUID> candidateIds = rows.stream().map(OfferCandidate::getCandidateId).toList();
        Set<UUID> consented = new HashSet<>(candidateRepository.findIdsWithRecruiterVisibilityConsent(candidateIds));
        Set<UUID> applied = new HashSet<>(offerCandidateRepository.findCandidateIdsWithApplication(offerId,
                candidateIds));
        Map<UUID, NormalizedProfile> profiles = new HashMap<>();
        normalizedProfileRepository.findAllById(rows.stream()
                .map(OfferCandidate::getCandidateNormalizedProfileId).distinct().toList())
                .forEach(profile -> profiles.put(profile.getId(), profile));
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(candidateIds).forEach(user -> users.put(user.getId(), user));

        List<SuggestedCandidateCard> items = rows.stream()
                .filter(row -> consented.contains(row.getCandidateId()))
                .map(row -> toCard(row, profiles.get(row.getCandidateNormalizedProfileId()),
                        users.get(row.getCandidateId()), applied.contains(row.getCandidateId())))
                .toList();
        log.info("Suggested candidates served : userId={}, offerId={}, count={}, withdrawnConsent={}", userId,
                offerId, items.size(), rows.size() - items.size());
        return new SuggestedCandidatesResponse(canInvite, items);
    }

    /**
     * Profil complet d'un candidat suggéré (T-102, D86). Mêmes droits et mêmes
     * 404/409 que la liste ; consentement retiré = 404 (la personne n'existe
     * plus pour le recruteur). La consultation est tracée en INFO.
     */
    @Transactional(readOnly = true)
    public SuggestedCandidateProfileResponse profile(UUID userId, UUID offerId, UUID suggestionId) {
        JobOffer offer = jobOfferService.getForMember(userId, offerId);
        requireOpen(offer);
        OfferCandidate row = requireVisible(userId, offerId, suggestionId);
        boolean applied = !offerCandidateRepository
                .findCandidateIdsWithApplication(offerId, List.of(row.getCandidateId())).isEmpty();
        SuggestedCandidateCard card = card(row, applied);
        User user = userRepository.findById(row.getCandidateId()).orElse(null);
        log.info("Suggested candidate profile viewed : userId={}, offerId={}, suggestionId={}", userId, offerId,
                suggestionId);
        return new SuggestedCandidateProfileResponse(card, user == null ? null : user.getCurrentCity(),
                user == null ? null : user.getCurrentCountry(), jobOfferService.canManage(userId, offer),
                candidateService.getProfile(row.getCandidateId()));
    }

    /**
     * Ligne de l'offre dont le candidat a toujours consenti, sinon 404 sûr
     * (suggestion inconnue, d'une autre offre, ou consentement retiré).
     */
    OfferCandidate requireVisible(UUID userId, UUID offerId, UUID suggestionId) {
        OfferCandidate row = offerCandidateRepository.findByIdAndJobOfferId(suggestionId, offerId)
                .orElseThrow(() -> {
                    log.warn("Suggested candidate rejected : unknown suggestion, offerId={}, suggestionId={}, userId={}",
                            offerId, suggestionId, userId);
                    return new InvalidInvitationException(HttpStatus.NOT_FOUND, NOT_FOUND);
                });
        if (!candidateRepository.existsByIdAndRecruiterVisibilityConsentAtIsNotNull(row.getCandidateId())) {
            log.warn("Suggested candidate rejected : consent withdrawn, offerId={}, suggestionId={}, userId={}",
                    offerId, suggestionId, userId);
            throw new InvalidInvitationException(HttpStatus.NOT_FOUND, NOT_FOUND);
        }
        return row;
    }

    /** Carte d'une seule ligne (invitation, détail) : charge fiche et compte. */
    SuggestedCandidateCard card(OfferCandidate row, boolean applied) {
        NormalizedProfile profile = normalizedProfileRepository.findById(row.getCandidateNormalizedProfileId())
                .orElse(null);
        User user = userRepository.findById(row.getCandidateId()).orElse(null);
        return toCard(row, profile, user, applied);
    }

    /** Carte d'une ligne ; le statut « applied » prime (dérivé de la candidature, jamais stocké). */
    SuggestedCandidateCard toCard(OfferCandidate row, NormalizedProfile profile, User user, boolean applied) {
        CandidateCardAnonymizer.Card card = anonymizer.anonymize(profile == null ? null : profile.getContent());
        String status = applied ? "applied" : row.getStatus().getApiValue();
        return new SuggestedCandidateCard(row.getId(), row.getRank(),
                user == null ? null : user.getFirstName(), user == null ? null : user.getLastName(),
                card.title(), card.seniority(), card.yearsOfExperience(), card.country(), card.skills(), status);
    }

    static void requireOpen(JobOffer offer) {
        if (!isOpen(offer)) {
            throw new InvalidInvitationException(HttpStatus.CONFLICT, OFFER_NOT_OPEN);
        }
    }

    static boolean isOpen(JobOffer offer) {
        return offer.getStatus() == JobOfferStatus.PUBLISHED
                && (offer.getExpiresAt() == null || !offer.getExpiresAt().isBefore(LocalDate.now()));
    }
}
