package com.linqorbit.application.service;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.application.dto.ApplicationCounts;
import com.linqorbit.application.dto.ApplicationJobSummary;
import com.linqorbit.application.dto.CandidateDashboardResponse;
import com.linqorbit.application.dto.DashboardApplication;
import com.linqorbit.application.entity.Application;
import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Chiffres du tableau de bord candidat : candidatures par statut (un GROUP BY),
 * les {@value #RECENT_LIMIT} plus récentes (une requête bornée, offres et
 * sociétés résolues en lots), invitations ouvertes et offres ouvertes du job
 * board (deux COUNT). Quatre à six requêtes quel que soit le volume : jamais de
 * chargement des candidatures complètes (réponses comprises) pour les compter.
 * Un compte sans profil candidat n'a aucune candidature : tout vaut 0.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CandidateDashboardService {

    static final int RECENT_LIMIT = 4;

    private final ApplicationRepository applicationRepository;
    private final OfferCandidateRepository offerCandidateRepository;
    private final JobOfferRepository jobOfferRepository;
    private final CompanyRepository companyRepository;

    @Transactional(readOnly = true)
    public CandidateDashboardResponse get(UUID userId) {
        LocalDate today = LocalDate.now();
        ApplicationCounts counts = counts(userId);
        List<DashboardApplication> recent = recent(userId);
        long openInvitations = offerCandidateRepository.countOpenInvitations(userId, OfferCandidateStatus.INVITED,
                JobOfferStatus.PUBLISHED, today);
        long openOffers = jobOfferRepository.countOpen(JobOfferStatus.PUBLISHED, today);
        log.info("Candidate dashboard served : userId={}, recent={}, openInvitations={}, openOffers={}", userId,
                recent.size(), openInvitations, openOffers);
        return new CandidateDashboardResponse(counts, recent, openInvitations, openOffers);
    }

    private ApplicationCounts counts(UUID userId) {
        Map<ApplicationStatus, Long> byStatus = new EnumMap<>(ApplicationStatus.class);
        for (Object[] row : applicationRepository.countByStatusForCandidate(userId)) {
            byStatus.put(ApplicationStatus.fromCode(((Number) row[0]).shortValue()), ((Number) row[1]).longValue());
        }
        return new ApplicationCounts(byStatus.getOrDefault(ApplicationStatus.DRAFT, 0L),
                byStatus.getOrDefault(ApplicationStatus.SUBMITTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.WITHDRAWN, 0L),
                byStatus.getOrDefault(ApplicationStatus.ACCEPTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.REJECTED, 0L));
    }

    private List<DashboardApplication> recent(UUID userId) {
        List<Application> applications = applicationRepository.findByCandidateIdOrderByCreatedAtDescIdDesc(userId,
                PageRequest.of(0, RECENT_LIMIT));
        if (applications.isEmpty()) {
            return List.of();
        }
        Map<UUID, JobOffer> offersById = new HashMap<>();
        jobOfferRepository.findAllById(applications.stream().map(Application::getJobOfferId).distinct().toList())
                .forEach(offer -> offersById.put(offer.getId(), offer));
        Map<UUID, String> companyNames = new HashMap<>();
        companyRepository.findAllById(offersById.values().stream().map(JobOffer::getCompanyId).distinct().toList())
                .forEach((Company company) -> companyNames.put(company.getId(), company.getName()));
        return applications.stream()
                .map(application -> {
                    JobOffer offer = offersById.get(application.getJobOfferId());
                    return new DashboardApplication(application.getId(), application.getStatus().getApiValue(),
                            application.getCreatedAt(), application.getUpdatedAt(),
                            new ApplicationJobSummary(offer.getPublicId(), offer.getSlug(), offer.getTitle(),
                                    companyNames.get(offer.getCompanyId())));
                })
                .toList();
    }
}
