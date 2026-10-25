package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.linqorbit.admin.dto.AdminDashboardResponse;
import com.linqorbit.application.entity.ApplicationStatus;
import com.linqorbit.application.repository.ApplicationRepository;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.embedding.repository.EmbeddingJobRepository;
import com.linqorbit.embedding.service.EmbeddingSettings;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportRepository;
import com.linqorbit.matching.repository.MatchingJobRepository;
import com.linqorbit.recruiter.repository.RecruiterRepository;
import com.linqorbit.screening.repository.ScreeningJobRepository;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

/**
 * Assemblage du tableau de bord admin : un statut absent des GROUP BY vaut 0, une plateforme vide renvoie
 * des zéros, chaque bloc lit sa propre source. Le SQL lui-même est vérifié sur PostgreSQL réel
 * ({@code AdminDashboardIntegrationTest}).
 */
@ExtendWith(MockitoExtension.class)
class AdminDashboardServiceTest {

    private static final UUID ADMIN = UUID.randomUUID();

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserRoleRepository userRoleRepository;
    @Mock
    private CandidateRepository candidateRepository;
    @Mock
    private RecruiterRepository recruiterRepository;
    @Mock
    private JobOfferRepository jobOfferRepository;
    @Mock
    private ApplicationRepository applicationRepository;
    @Mock
    private SkillSuggestionRepository skillSuggestionRepository;
    @Mock
    private MatchingCriterionReportRepository criterionReportRepository;
    @Mock
    private NormalizationJobRepository normalizationJobRepository;
    @Mock
    private EmbeddingJobRepository embeddingJobRepository;
    @Mock
    private ScreeningJobRepository screeningJobRepository;
    @Mock
    private MatchingJobRepository matchingJobRepository;
    @Mock
    private EmbeddingSettings embeddingSettings;

    @InjectMocks
    private AdminDashboardService service;

    @Test
    void anEmptyPlatformGetsZerosEverywhere() {
        // Mocks nus : listes vides, compteurs à 0.
        AdminDashboardResponse body = service.get(ADMIN);

        assertThat(body.accounts()).isEqualTo(new AdminDashboardResponse.AccountCounts(0, 0, 0, 0, 0, 0, 0));
        assertThat(body.offers()).isEqualTo(new AdminDashboardResponse.OfferCounts(0, 0, 0, 0));
        assertThat(body.liveOffers()).isZero();
        assertThat(body.applications()).isEqualTo(new AdminDashboardResponse.ApplicationCounts(0, 0, 0, 0));
        assertThat(body.moderation()).isEqualTo(new AdminDashboardResponse.ModerationCounts(0, 0, 0));
        assertThat(body.processingFailures())
                .isEqualTo(new AdminDashboardResponse.ProcessingFailures(0, 0, 0, 0, 0));
    }

    @Test
    void everyProcessingQueueReadsItsOwnSourceWithTheFailedStatusCode() {
        short failed = 4;
        when(embeddingSettings.getModelName()).thenReturn("model");
        when(embeddingSettings.getModelVersion()).thenReturn("1");
        when(embeddingSettings.getStrategyVersion()).thenReturn("text-1");
        when(normalizationJobRepository.countFailedLatestForCandidates(failed)).thenReturn(2L);
        when(normalizationJobRepository.countFailedLatestForOffers(failed)).thenReturn(3L);
        when(embeddingJobRepository.countFailedCurrent(failed, "model", "1", "text-1")).thenReturn(5L);
        when(screeningJobRepository.countFailedCurrent(failed)).thenReturn(7L);
        when(matchingJobRepository.countFailedLatest(failed)).thenReturn(11L);

        AdminDashboardResponse body = service.get(ADMIN);

        assertThat(body.processingFailures())
                .isEqualTo(new AdminDashboardResponse.ProcessingFailures(2, 3, 5, 7, 11));
    }

    @Test
    void anAbsentStatusCountsAsZeroAndEveryBlockReadsItsOwnSource() {
        when(userRepository.countByStatus()).thenReturn(List.<Object[]>of(new Object[] {UserStatus.ACTIVE, 5L},
                new Object[] {UserStatus.SUSPENDED, 2L}));
        when(userRepository.countByCreatedAtGreaterThanEqual(any(LocalDateTime.class))).thenReturn(3L);
        when(candidateRepository.count()).thenReturn(4L);
        when(recruiterRepository.count()).thenReturn(2L);
        when(userRoleRepository.countByRole((short) 1)).thenReturn(1L);
        when(jobOfferRepository.countByStatus()).thenReturn(List.<Object[]>of(
                new Object[] {JobOfferStatus.PUBLISHED, 7L}, new Object[] {JobOfferStatus.DRAFT, 1L}));
        when(jobOfferRepository.countOpen(eq(JobOfferStatus.PUBLISHED), any(LocalDate.class))).thenReturn(6L);
        when(applicationRepository.countVisibleByStatus(anyList())).thenReturn(List.<Object[]>of(
                new Object[] {(short) ApplicationStatus.SUBMITTED.getCode(), 9L},
                new Object[] {(short) ApplicationStatus.REJECTED.getCode(), 1L}));
        when(applicationRepository.countVisibleSubmittedSince(anyList(), any(LocalDateTime.class))).thenReturn(4L);
        when(skillSuggestionRepository.count()).thenReturn(8L);
        when(criterionReportRepository.countAwaitingReview(ADMIN)).thenReturn(2L);
        when(criterionReportRepository.count()).thenReturn(5L);

        AdminDashboardResponse body = service.get(ADMIN);

        assertThat(body.accounts()).isEqualTo(new AdminDashboardResponse.AccountCounts(5, 0, 2, 4, 2, 1, 3));
        assertThat(body.offers()).isEqualTo(new AdminDashboardResponse.OfferCounts(1, 0, 7, 0));
        assertThat(body.liveOffers()).isEqualTo(6);
        assertThat(body.applications()).isEqualTo(new AdminDashboardResponse.ApplicationCounts(9, 0, 1, 4));
        assertThat(body.moderation()).isEqualTo(new AdminDashboardResponse.ModerationCounts(8, 2, 5));
    }
}
