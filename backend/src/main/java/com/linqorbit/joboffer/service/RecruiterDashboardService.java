package com.linqorbit.joboffer.service;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.company.entity.CompanyMember;
import com.linqorbit.company.repository.CompanyMemberRepository;
import com.linqorbit.invitation.entity.OfferCandidateStatus;
import com.linqorbit.invitation.repository.OfferCandidateRepository;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse.AttentionOffer;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse.CandidateCounts;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse.ClosingSoon;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse.OfferCounts;
import com.linqorbit.joboffer.dto.RecruiterDashboardResponse.ReviewCounts;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;
import com.linqorbit.recruiter.repository.RecruiterRepository;
import com.linqorbit.screening.dto.ScreeningSignal;
import com.linqorbit.screening.entity.ScreeningJobStatus;
import com.linqorbit.screening.repository.ScreeningJobRepository;
import com.linqorbit.screening.service.ScreeningSignals;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Chiffres du tableau de bord recruteur : offres de toutes les sociétés dont le compte est membre
 * (D12 : tout membre lit). Une dizaine de requêtes agrégées, quel que soit le volume — un GROUP BY
 * par statut d'offre, un par statut de candidature, quelques COUNT et une requête bornée pour les
 * {@value #ATTENTION_LIMIT} offres à regarder. Chaque compteur reprend le prédicat de la liste dont
 * il est le total (offres ouvertes = job board, à examiner = onglet « Submitted », à inviter =
 * suggestions invitables) : les tests d'intégration épinglent ces égalités. Un recruteur sans société
 * obtient des zéros sans autre requête.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecruiterDashboardService {

    static final int ATTENTION_LIMIT = 5;

    /** Candidatures que le recruteur voit : ni brouillon ni retrait. */
    private static final List<Short> VISIBLE_APPLICATIONS = List.of(
            (short) ApplicationStatus.SUBMITTED.getCode(),
            (short) ApplicationStatus.ACCEPTED.getCode(),
            (short) ApplicationStatus.REJECTED.getCode());

    /** Tout sauf « transmise » : le compteur par offre de la liste, qui n'additionne que les SUBMITTED. */
    private static final List<Short> NOT_PENDING_APPLICATIONS = List.of(
            (short) ApplicationStatus.DRAFT.getCode(),
            (short) ApplicationStatus.WITHDRAWN.getCode(),
            (short) ApplicationStatus.ACCEPTED.getCode(),
            (short) ApplicationStatus.REJECTED.getCode());

    private final RecruiterRepository recruiterRepository;
    private final CompanyMemberRepository companyMemberRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ApplicationRepository applicationRepository;
    private final OfferCandidateRepository offerCandidateRepository;
    private final ScreeningJobRepository screeningJobRepository;
    private final ScreeningSignals screeningSignals;

    @Transactional(readOnly = true)
    public RecruiterDashboardResponse get(UUID userId) {
        if (!recruiterRepository.existsById(userId)) {
            log.warn("Recruiter dashboard rejected : no recruiter profile, userId={}", userId);
            throw new RecruiterNotFoundException();
        }
        List<UUID> companyIds = companyMemberRepository.findByRecruiterId(userId).stream()
                .map(CompanyMember::getCompanyId)
                .toList();
        if (companyIds.isEmpty()) {
            return empty();
        }
        LocalDate today = LocalDate.now();

        OfferCounts offers = offerCounts(companyIds);
        long liveOffers = jobOfferRepository.countOpenForCompanies(companyIds, JobOfferStatus.PUBLISHED, today);
        ClosingSoon closingSoon = closingSoon(companyIds, today);
        ReviewCounts applications = reviewCounts(companyIds);
        CandidateCounts candidates = candidateCounts(companyIds, today);
        List<AttentionOffer> attention = attention(companyIds, today);

        log.info("Recruiter dashboard served : userId={}, companies={}, liveOffers={}, toReview={}, attention={}",
                userId, companyIds.size(), liveOffers, applications.toReview(), attention.size());
        return new RecruiterDashboardResponse(offers, liveOffers, closingSoon, applications, candidates, attention);
    }

    private static RecruiterDashboardResponse empty() {
        return new RecruiterDashboardResponse(new OfferCounts(0, 0, 0, 0), 0, new ClosingSoon(0, null),
                new ReviewCounts(0, 0, 0), new CandidateCounts(0, 0, 0), List.of());
    }

    private OfferCounts offerCounts(List<UUID> companyIds) {
        Map<JobOfferStatus, Long> byStatus = new EnumMap<>(JobOfferStatus.class);
        for (Object[] row : jobOfferRepository.countByStatusForCompanies(companyIds)) {
            byStatus.put((JobOfferStatus) row[0], ((Number) row[1]).longValue());
        }
        return new OfferCounts(byStatus.getOrDefault(JobOfferStatus.DRAFT, 0L),
                byStatus.getOrDefault(JobOfferStatus.VALIDATED, 0L),
                byStatus.getOrDefault(JobOfferStatus.PUBLISHED, 0L),
                byStatus.getOrDefault(JobOfferStatus.CLOSED, 0L));
    }

    /** Même fenêtre que le filtre « expiringSoon » de la liste : aujourd'hui inclus, bornes incluses. */
    private ClosingSoon closingSoon(List<UUID> companyIds, LocalDate today) {
        Object[] row = jobOfferRepository.closingSoonForCompanies(companyIds, JobOfferStatus.PUBLISHED, today,
                today.plusDays(JobOfferService.EXPIRING_SOON_DAYS)).get(0);
        return new ClosingSoon(((Number) row[0]).longValue(), (LocalDate) row[1]);
    }

    private ReviewCounts reviewCounts(List<UUID> companyIds) {
        Map<ApplicationStatus, Long> byStatus = new EnumMap<>(ApplicationStatus.class);
        for (Object[] row : applicationRepository.countByStatusForCompanies(companyIds, VISIBLE_APPLICATIONS)) {
            byStatus.put(ApplicationStatus.fromCode(((Number) row[0]).shortValue()), ((Number) row[1]).longValue());
        }
        return new ReviewCounts(byStatus.getOrDefault(ApplicationStatus.SUBMITTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.ACCEPTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.REJECTED, 0L));
    }

    private CandidateCounts candidateCounts(List<UUID> companyIds, LocalDate today) {
        Object[] row = offerCandidateRepository.countToInviteAndInvited(companyIds,
                (short) OfferCandidateStatus.SUGGESTED.getCode(), (short) OfferCandidateStatus.INVITED.getCode(),
                (short) JobOfferStatus.PUBLISHED.getCode(), today, SearchStatus.NOT_LOOKING.getCode()).get(0);
        long searchesFailed = screeningJobRepository.countLatestFailedOnOpenOffers(companyIds,
                JobOfferStatus.PUBLISHED, today, ScreeningJobStatus.FAILED, ScreeningJobStatus.SUPERSEDED);
        return new CandidateCounts(((Number) row[0]).longValue(), ((Number) row[1]).longValue(), searchesFailed);
    }

    private List<AttentionOffer> attention(List<UUID> companyIds, LocalDate today) {
        List<UUID> ids = jobOfferRepository.findAttentionOfferIds(companyIds,
                (short) ApplicationStatus.SUBMITTED.getCode(), (short) JobOfferStatus.PUBLISHED.getCode(), today,
                today.plusDays(JobOfferService.EXPIRING_SOON_DAYS), ATTENTION_LIMIT);
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, JobOffer> offersById = new HashMap<>();
        jobOfferRepository.findAllById(ids).forEach(offer -> offersById.put(offer.getId(), offer));
        Map<UUID, Long> toReview = new HashMap<>();
        for (Object[] row : applicationRepository.countVisibleApplicationsByOfferIds(ids, NOT_PENDING_APPLICATIONS)) {
            toReview.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        Map<UUID, ScreeningSignal> screenings = screeningSignals.forOffers(ids);
        return ids.stream()
                .map(offersById::get)
                .map(offer -> new AttentionOffer(offer.getId(), offer.getTitle(), offer.getStatus().getApiValue(),
                        offer.getExpiresAt(), toReview.getOrDefault(offer.getId(), 0L),
                        screenings.get(offer.getId())))
                .toList();
    }
}
