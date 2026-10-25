package com.linqorbit.invitation.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.application.dto.ApplicationJobSummary;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.invitation.dto.CandidateInvitationResponse;
import com.linqorbit.invitation.entity.OfferCandidate;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Invitations reçues par le candidat connecté (T-101, D85) : offres encore
 * ouvertes (PUBLISHED, non expirées) pour lesquelles un recruteur l'a invité
 * et auxquelles il n'a pas encore candidaté (toute candidature, brouillon
 * compris, la fait sortir de la liste — elle apparaît alors dans « My
 * applications »). Plus récente d'abord. Lecture seule, résolue en lots :
 * jamais une requête par ligne.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateInvitationService {

    private final OfferCandidateRepository offerCandidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final CompanyRepository companyRepository;

    @Transactional(readOnly = true)
    public List<CandidateInvitationResponse> mine(UUID candidateId) {
        List<OfferCandidate> rows = offerCandidateRepository.findOpenInvitations(candidateId,
                OfferCandidateStatus.INVITED, JobOfferStatus.PUBLISHED, LocalDate.now());
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, JobOffer> offers = new HashMap<>();
        jobOfferRepository.findAllById(rows.stream().map(OfferCandidate::getJobOfferId).distinct().toList())
                .forEach(offer -> offers.put(offer.getId(), offer));
        Map<UUID, String> companyNames = new HashMap<>();
        companyRepository.findAllById(offers.values().stream().map(JobOffer::getCompanyId).distinct().toList())
                .forEach(company -> companyNames.put(company.getId(), company.getName()));

        List<CandidateInvitationResponse> invitations = rows.stream()
                .filter(row -> offers.containsKey(row.getJobOfferId()))
                .map(row -> {
                    JobOffer offer = offers.get(row.getJobOfferId());
                    return new CandidateInvitationResponse(row.getId(), row.getInvitedAt(),
                            new ApplicationJobSummary(offer.getPublicId(), offer.getSlug(), offer.getTitle(),
                                    companyNames.get(offer.getCompanyId())));
                })
                .toList();
        log.info("Candidate invitations served : candidateId={}, count={}", candidateId, invitations.size());
        return invitations;
    }
}
