package com.linqorbit.admin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.admin.dto.AdminDashboardResponse;
import com.linqorbit.admin.dto.AdminDashboardResponse.AccountCounts;
import com.linqorbit.admin.dto.AdminDashboardResponse.ApplicationCounts;
import com.linqorbit.admin.dto.AdminDashboardResponse.ModerationCounts;
import com.linqorbit.admin.dto.AdminDashboardResponse.OfferCounts;
import com.linqorbit.admin.dto.AdminDashboardResponse.ProcessingFailures;
import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.embedding.entity.EmbeddingJobStatus;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;
import com.linqorbit.embedding.service.EmbeddingSettings;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.matching.entity.MatchingJobStatus;
import com.linqorbit.matching.repository.MatchingCriterionReportRepository;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.recruiter.repository.RecruiterRepository;
import com.linqorbit.screening.entity.ScreeningJobStatus;
import com.linqorbit.screening.repository.ScreeningJobRepository;
import com.linqorbit.user.Role;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Chiffres du tableau de bord admin : toute la plateforme, une quinzaine de requêtes agrégées quel que
 * soit le volume — un GROUP BY par statut de compte, d'offre et de candidature, quelques COUNT. Chaque
 * compteur reprend le prédicat de la liste admin dont il est le total (comptes = {@code GET /admin/users},
 * offres = {@code GET /admin/job-offers}, offres ouvertes = job board, suggestions = file des suggestions,
 * signalements à relire = {@code canReview} du dossier) : les tests d'intégration épinglent ces égalités.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    static final int NEW_WINDOW_DAYS = 7;

    /** Candidatures que le recruteur voit : ni brouillon ni retrait. */
    private static final List<Short> VISIBLE_APPLICATIONS = List.of(
            (short) ApplicationStatus.SUBMITTED.getCode(),
            (short) ApplicationStatus.ACCEPTED.getCode(),
            (short) ApplicationStatus.REJECTED.getCode());

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final CandidateRepository candidateRepository;
    private final RecruiterRepository recruiterRepository;
    private final JobOfferRepository jobOfferRepository;
    private final ApplicationRepository applicationRepository;
    private final SkillSuggestionRepository skillSuggestionRepository;
    private final MatchingCriterionReportRepository criterionReportRepository;
    private final NormalizationJobRepository normalizationJobRepository;
    private final EmbeddingJobRepository embeddingJobRepository;
    private final ScreeningJobRepository screeningJobRepository;
    private final MatchingJobRepository matchingJobRepository;
    private final EmbeddingSettings embeddingSettings;

    @Transactional(readOnly = true)
    public AdminDashboardResponse get(UUID adminUserId) {
        LocalDateTime since = LocalDateTime.now().minusDays(NEW_WINDOW_DAYS);

        AccountCounts accounts = accountCounts(since);
        OfferCounts offers = offerCounts();
        long liveOffers = jobOfferRepository.countOpen(JobOfferStatus.PUBLISHED, LocalDate.now());
        ApplicationCounts applications = applicationCounts(since);
        ModerationCounts moderation = new ModerationCounts(
                skillSuggestionRepository.count(),
                criterionReportRepository.countAwaitingReview(adminUserId),
                criterionReportRepository.count());

        ProcessingFailures processingFailures = processingFailures();

        log.info("Admin dashboard served : adminUserId={}, activeAccounts={}, liveOffers={}, toReview={}",
                adminUserId, accounts.active(), liveOffers, applications.toReview());
        return new AdminDashboardResponse(accounts, offers, liveOffers, applications, moderation, processingFailures);
    }

    /**
     * Cinq COUNT, un par file de traitement : l'échec est le statut FAILED (tentatives épuisées) du dernier
     * job de chaque sujet — voir les requêtes des repositories pour la notion de « remplacé ».
     */
    private ProcessingFailures processingFailures() {
        return new ProcessingFailures(
                normalizationJobRepository.countFailedLatestForCandidates(
                        (short) NormalizationJobStatus.FAILED.getCode()),
                normalizationJobRepository.countFailedLatestForOffers((short) NormalizationJobStatus.FAILED.getCode()),
                embeddingJobRepository.countFailedCurrent((short) EmbeddingJobStatus.FAILED.getCode(),
                        embeddingSettings.getModelName(), embeddingSettings.getModelVersion(),
                        embeddingSettings.getStrategyVersion()),
                screeningJobRepository.countFailedCurrent((short) ScreeningJobStatus.FAILED.getCode()),
                matchingJobRepository.countFailedLatest((short) MatchingJobStatus.FAILED.getCode()));
    }

    private AccountCounts accountCounts(LocalDateTime since) {
        Map<UserStatus, Long> byStatus = new EnumMap<>(UserStatus.class);
        for (Object[] row : userRepository.countByStatus()) {
            byStatus.put((UserStatus) row[0], ((Number) row[1]).longValue());
        }
        return new AccountCounts(byStatus.getOrDefault(UserStatus.ACTIVE, 0L),
                byStatus.getOrDefault(UserStatus.INACTIVE, 0L),
                byStatus.getOrDefault(UserStatus.SUSPENDED, 0L),
                candidateRepository.count(),
                recruiterRepository.count(),
                userRoleRepository.countByRole((short) Role.ADMIN.getCode()),
                userRepository.countByCreatedAtGreaterThanEqual(since));
    }

    private OfferCounts offerCounts() {
        Map<JobOfferStatus, Long> byStatus = new EnumMap<>(JobOfferStatus.class);
        for (Object[] row : jobOfferRepository.countByStatus()) {
            byStatus.put((JobOfferStatus) row[0], ((Number) row[1]).longValue());
        }
        return new OfferCounts(byStatus.getOrDefault(JobOfferStatus.DRAFT, 0L),
                byStatus.getOrDefault(JobOfferStatus.VALIDATED, 0L),
                byStatus.getOrDefault(JobOfferStatus.PUBLISHED, 0L),
                byStatus.getOrDefault(JobOfferStatus.CLOSED, 0L));
    }

    private ApplicationCounts applicationCounts(LocalDateTime since) {
        Map<ApplicationStatus, Long> byStatus = new EnumMap<>(ApplicationStatus.class);
        for (Object[] row : applicationRepository.countVisibleByStatus(VISIBLE_APPLICATIONS)) {
            byStatus.put(ApplicationStatus.fromCode(((Number) row[0]).shortValue()), ((Number) row[1]).longValue());
        }
        return new ApplicationCounts(byStatus.getOrDefault(ApplicationStatus.SUBMITTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.ACCEPTED, 0L),
                byStatus.getOrDefault(ApplicationStatus.REJECTED, 0L),
                applicationRepository.countVisibleSubmittedSince(VISIBLE_APPLICATIONS, since));
    }
}
