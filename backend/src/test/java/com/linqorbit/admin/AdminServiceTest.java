package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.linqorbit.admin.dto.AdminCriterionReportDetailResponse;
import com.linqorbit.admin.dto.AdminCriterionReportPageResponse;
import com.linqorbit.admin.dto.AdminCriterionReportReviewResponse;
import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferListItem;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserPageResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.dto.CreateCriterionReportReviewRequest;
import com.linqorbit.admin.exception.CriterionReportNotFoundException;
import com.linqorbit.admin.exception.CriterionReportReviewConflictException;
import com.linqorbit.admin.exception.InvalidCriterionReportReviewException;
import com.linqorbit.admin.exception.InvalidOfferStatusFilterException;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserCapabilityFilterException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.NormalizedProfileNotFoundException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.repository.CandidateRepository;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.candidate.entity.SkillType;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillSuggestion;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.NormalizationJobRepository;
import com.linqorbit.candidate.repository.NormalizedProfileRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.JobOfferAdminView;
import com.linqorbit.joboffer.dto.PublicJobResponse;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferStatus;
import com.linqorbit.joboffer.entity.SalaryPeriod;
import com.linqorbit.joboffer.entity.Seniority;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.dto.JobOfferListFilters;
import com.linqorbit.joboffer.exception.InvalidJobOfferFilterException;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.JobOfferRow;
import com.linqorbit.joboffer.repository.JobOfferSearch;
import com.linqorbit.joboffer.repository.JobOfferSearchRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferService;
import com.linqorbit.recruiter.entity.Recruiter;
import com.linqorbit.application.service.ApplicationAssessmentReader;
import com.linqorbit.matching.entity.CriterionReportReason;
import com.linqorbit.matching.entity.CriterionReportReviewVerdict;
import com.linqorbit.matching.entity.MatchingCriterionReport;
import com.linqorbit.matching.entity.MatchingCriterionReportReview;
import com.linqorbit.matching.repository.MatchingCriterionFeedbackRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportRepository;
import com.linqorbit.matching.repository.MatchingCriterionReportReviewRepository;
import com.linqorbit.matching.repository.MatchingRepository;
import com.linqorbit.matching.repository.MatchingResultRepository;
import com.linqorbit.matching.service.MatchingResultReader;
import com.linqorbit.recruiter.repository.RecruiterRepository;
import com.linqorbit.user.Role;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserSex;
import com.linqorbit.user.UserStatus;

import tools.jackson.databind.ObjectMapper;

class AdminServiceTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private SkillSuggestionRepository skillSuggestionRepository;
    private SkillRepository skillRepository;
    private CandidateRepository candidateRepository;
    private CandidateSkillRepository candidateSkillRepository;
    private RecruiterRepository recruiterRepository;
    private NormalizedProfileRepository normalizedProfileRepository;
    private NormalizedProfileJobOfferRepository normalizedProfileJobOfferRepository;
    private NormalizationJobRepository normalizationJobRepository;
    private JobOfferRepository jobOfferRepository;
    private JobOfferSearchRepository jobOfferSearchRepository;
    private JobOfferService jobOfferService;
    private CandidateService candidateService;
    private CompanyRepository companyRepository;
    private MatchingCriterionReportRepository criterionReportRepository;
    private MatchingCriterionReportReviewRepository criterionReportReviewRepository;
    private MatchingCriterionFeedbackRepository feedbackRepository;
    private MatchingRepository matchingRepository;
    private MatchingResultRepository matchingResultRepository;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        skillSuggestionRepository = mock(SkillSuggestionRepository.class);
        skillRepository = mock(SkillRepository.class);
        candidateRepository = mock(CandidateRepository.class);
        candidateSkillRepository = mock(CandidateSkillRepository.class);
        recruiterRepository = mock(RecruiterRepository.class);
        normalizedProfileRepository = mock(NormalizedProfileRepository.class);
        normalizedProfileJobOfferRepository = mock(NormalizedProfileJobOfferRepository.class);
        normalizationJobRepository = mock(NormalizationJobRepository.class);
        jobOfferRepository = mock(JobOfferRepository.class);
        jobOfferSearchRepository = mock(JobOfferSearchRepository.class);
        jobOfferService = mock(JobOfferService.class);
        candidateService = mock(CandidateService.class);
        companyRepository = mock(CompanyRepository.class);
        criterionReportRepository = mock(MatchingCriterionReportRepository.class);
        criterionReportReviewRepository = mock(MatchingCriterionReportReviewRepository.class);
        feedbackRepository = mock(MatchingCriterionFeedbackRepository.class);
        matchingRepository = mock(MatchingRepository.class);
        matchingResultRepository = mock(MatchingResultRepository.class);
        MatchingResultReader matchingResultReader = new MatchingResultReader(new ObjectMapper());
        adminService = new AdminService(userRepository, userRoleRepository, skillSuggestionRepository,
                skillRepository, candidateRepository, candidateSkillRepository, recruiterRepository,
                normalizedProfileRepository, normalizedProfileJobOfferRepository,
                normalizationJobRepository, jobOfferRepository, jobOfferSearchRepository, jobOfferService,
                candidateService,
                companyRepository, criterionReportRepository, criterionReportReviewRepository,
                feedbackRepository, matchingRepository, matchingResultRepository, matchingResultReader,
                new ApplicationAssessmentReader(matchingResultReader, matchingResultRepository),
                new ObjectMapper());
    }

    @Test
    void listUsersRetourneLaPageAvecStatutRolesEtDrapeaux() {
        User ada = User.builder().id(UUID.randomUUID()).email("ada@example.com")
                .firstName("Ada").lastName("Lovelace").status(UserStatus.ACTIVE).build();
        User bob = User.builder().id(UUID.randomUUID()).email("bob@example.com")
                .firstName("Bob").lastName("Morris").status(UserStatus.INACTIVE).build();
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.searchUsers(null, null, null, pageable))
                .thenReturn(new PageImpl<>(List.of(ada, bob), pageable, 2));
        when(userRoleRepository.findByUserIdIn(List.of(ada.getId(), bob.getId())))
                .thenReturn(List.of(UserRole.of(ada.getId(), Role.ADMIN)));
        when(candidateRepository.findAllById(List.of(ada.getId(), bob.getId())))
                .thenReturn(List.of(Candidate.builder().id(ada.getId()).build()));
        when(recruiterRepository.findAllById(List.of(ada.getId(), bob.getId())))
                .thenReturn(List.of(Recruiter.builder().id(bob.getId()).build()));

        AdminUserPageResponse response = adminService.listUsers(null, null, null, 0, null);

        assertThat(response.items()).hasSize(2);
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(20);
        assertThat(response.total()).isEqualTo(2);
        AdminUserResponse adaResponse = response.items().get(0);
        assertThat(adaResponse.email()).isEqualTo("ada@example.com");
        assertThat(adaResponse.status()).isEqualTo("ACTIVE");
        assertThat(adaResponse.roles()).containsExactly((short) 1);
        assertThat(adaResponse.hasCandidateProfile()).isTrue();
        assertThat(adaResponse.hasRecruiterProfile()).isFalse();
        assertThat(response.items().get(1).status()).isEqualTo("INACTIVE");
        assertThat(response.items().get(1).roles()).isEmpty();
        assertThat(response.items().get(1).hasCandidateProfile()).isFalse();
        assertThat(response.items().get(1).hasRecruiterProfile()).isTrue();
    }

    @Test
    void listUsersBorneLaPagination() {
        Pageable pageable = PageRequest.of(0, 50);
        when(userRepository.searchUsers(null, null, null, pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        AdminUserPageResponse response = adminService.listUsers(null, null, null, -2, 500);

        assertThat(response.items()).isEmpty();
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(50);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(userRepository).searchUsers(isNull(), isNull(), isNull(), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageNumber()).isZero();
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50);
    }

    @Test
    void listUsersNormaliseRechercheEtTransmetLesFiltres() {
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.searchUsers(eq("%ada%"), eq(UserStatus.INACTIVE), eq("candidate"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        AdminUserPageResponse response = adminService.listUsers("  Ada ", "inactive", "CANDIDATE", 0, null);

        assertThat(response.items()).isEmpty();
        verify(userRepository).searchUsers("%ada%", UserStatus.INACTIVE, "candidate", pageable);
    }

    @Test
    void listUsersTraiteLesFiltresVidesCommeAbsents() {
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.searchUsers(isNull(), isNull(), eq("recruiter"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        adminService.listUsers("   ", "", "recruiter", 0, null);

        verify(userRepository).searchUsers(isNull(), isNull(), eq("recruiter"), eq(pageable));
    }

    @Test
    void listUsersRefuseUnFiltreDeStatutNonSupporte() {
        assertThatThrownBy(() -> adminService.listUsers(null, "suspended", null, 0, null))
                .isInstanceOf(InvalidUserStatusException.class);
    }

    @Test
    void listUsersRefuseUnFiltreDeCapaciteInconnu() {
        assertThatThrownBy(() -> adminService.listUsers(null, null, "admin", 0, null))
                .isInstanceOf(InvalidUserCapabilityFilterException.class);
    }

    @Test
    void updateUserStatusActiveUnCompteInactif() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User target = User.builder().id(targetId).email("bob@example.com").status(UserStatus.INACTIVE).build();
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        adminService.updateUserStatus(targetId, UserStatus.ACTIVE, adminId);

        assertThat(target.getStatus()).isEqualTo(UserStatus.ACTIVE);
        verify(userRepository).save(target);
    }

    @Test
    void updateUserStatusRejetteLePropreCompteDeLAdministrateur() {
        UUID adminId = UUID.randomUUID();

        assertThatThrownBy(() -> adminService.updateUserStatus(adminId, UserStatus.INACTIVE, adminId))
                .isInstanceOf(SelfStatusChangeException.class);
        verify(userRepository, never()).findById(any());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserStatusRejetteLeStatutSuspended() {
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();

        assertThatThrownBy(() -> adminService.updateUserStatus(targetId, UserStatus.SUSPENDED, adminId))
                .isInstanceOf(InvalidUserStatusException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserStatusRejetteUnCompteInconnu() {
        UUID adminId = UUID.randomUUID();
        UUID unknownId = UUID.randomUUID();
        when(userRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.updateUserStatus(unknownId, UserStatus.INACTIVE, adminId))
                .isInstanceOf(UserNotFoundException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void listSkillSuggestionsJointAuteurEtGardeLOrdreDuTri() {
        UUID adaId = UUID.randomUUID();
        UUID ghostId = UUID.randomUUID();
        SkillSuggestion first = SkillSuggestion.builder()
                .id(UUID.randomUUID()).candidateId(adaId).name("Rust")
                .createdAt(LocalDateTime.of(2026, 10, 2, 10, 0)).build();
        SkillSuggestion second = SkillSuggestion.builder()
                .id(UUID.randomUUID()).candidateId(ghostId).name("COBOL")
                .createdAt(LocalDateTime.of(2026, 9, 1, 10, 0)).build();
        when(skillSuggestionRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(first, second));
        when(userRepository.findAllById(any())).thenReturn(List.of(
                User.builder().id(adaId).email("ada@example.com")
                        .firstName("Ada").lastName("Lovelace").build()));

        List<AdminSkillSuggestionResponse> suggestions = adminService.listSkillSuggestions();

        assertThat(suggestions).hasSize(2);
        assertThat(suggestions.get(0).name()).isEqualTo("Rust");
        assertThat(suggestions.get(0).candidateFirstName()).isEqualTo("Ada");
        assertThat(suggestions.get(0).candidateLastName()).isEqualTo("Lovelace");
        assertThat(suggestions.get(0).candidateEmail()).isEqualTo("ada@example.com");
        assertThat(suggestions.get(1).name()).isEqualTo("COBOL");
        assertThat(suggestions.get(1).candidateFirstName()).isNull();
    }

    @Test
    void approveSuggestionCreeLeSkillEtInscritLesAuteursAuNiveau1() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID adaId = UUID.randomUUID();
        UUID bobId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(adaId).name("Figma")
                .createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        SkillSuggestion twin = SkillSuggestion.builder().id(UUID.randomUUID()).candidateId(bobId).name("figma")
                .createdAt(LocalDateTime.of(2026, 10, 4, 10, 0)).build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillSuggestionRepository.findAllByNameIgnoreCase("Figma")).thenReturn(List.of(clicked, twin));
        when(skillRepository.findAll()).thenReturn(List.of(
                Skill.builder().name("Miro").skillType(SkillType.TECH).category("Design").build()));
        when(skillRepository.findByNameIgnoreCase("Figma")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> {
            Skill saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(candidateSkillRepository.existsByCandidateIdAndSkillId(any(), any())).thenReturn(false);
        when(candidateRepository.findById(adaId)).thenReturn(Optional.of(Candidate.builder().id(adaId).build()));
        when(candidateRepository.findById(bobId)).thenReturn(Optional.of(Candidate.builder().id(bobId).build()));
        when(candidateSkillRepository.save(any(CandidateSkill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        adminService.approveSuggestion(suggestionId, "Design", "tech", adminId);

        ArgumentCaptor<Skill> skillCaptor = ArgumentCaptor.forClass(Skill.class);
        verify(skillRepository).save(skillCaptor.capture());
        assertThat(skillCaptor.getValue().getName()).isEqualTo("Figma");
        assertThat(skillCaptor.getValue().getSkillType()).isEqualTo(SkillType.TECH);
        assertThat(skillCaptor.getValue().getCategory()).isEqualTo("Design");

        ArgumentCaptor<CandidateSkill> grantCaptor = ArgumentCaptor.forClass(CandidateSkill.class);
        verify(candidateSkillRepository, times(2)).save(grantCaptor.capture());
        assertThat(grantCaptor.getAllValues()).allSatisfy(grant -> {
            assertThat(grant.getLevel()).isEqualTo(1);
            assertThat(grant.getYearsExperience()).isNull();
        });
        assertThat(grantCaptor.getAllValues())
                .extracting(grant -> grant.getCandidate().getId())
                .containsExactlyInAnyOrder(adaId, bobId);
        verify(skillSuggestionRepository).deleteAll(List.of(clicked, twin));
    }

    @Test
    void approveSuggestionNeCreePasDeDoublonQuandLeNomExisteDeja() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID adaId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(adaId).name("Figma")
                .createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        Skill existing = Skill.builder().id(UUID.randomUUID()).name("figma")
                .skillType(SkillType.TECH).category("Design").build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillSuggestionRepository.findAllByNameIgnoreCase("Figma")).thenReturn(List.of(clicked));
        when(skillRepository.findAll()).thenReturn(List.of(existing));
        when(skillRepository.findByNameIgnoreCase("Figma")).thenReturn(Optional.of(existing));
        when(candidateSkillRepository.existsByCandidateIdAndSkillId(adaId, existing.getId())).thenReturn(false);
        when(candidateRepository.findById(adaId)).thenReturn(Optional.of(Candidate.builder().id(adaId).build()));
        when(candidateSkillRepository.save(any(CandidateSkill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        adminService.approveSuggestion(suggestionId, "Design", "TECH", adminId);

        verify(skillRepository, never()).save(any(Skill.class));
        verify(candidateSkillRepository).save(any(CandidateSkill.class));
        verify(skillSuggestionRepository).deleteAll(List.of(clicked));
    }

    @Test
    void approveSuggestionIgnoreLesAuteursQuiOntDejaLaCompetence() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID adaId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(adaId).name("Figma")
                .createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        Skill created = Skill.builder().id(UUID.randomUUID()).name("Figma")
                .skillType(SkillType.TECH).category("Design").build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillSuggestionRepository.findAllByNameIgnoreCase("Figma")).thenReturn(List.of(clicked));
        when(skillRepository.findAll()).thenReturn(List.of(created));
        when(skillRepository.findByNameIgnoreCase("Figma")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenReturn(created);
        when(candidateSkillRepository.existsByCandidateIdAndSkillId(adaId, created.getId())).thenReturn(true);

        adminService.approveSuggestion(suggestionId, "Design", "tech", adminId);

        verify(candidateSkillRepository, never()).save(any(CandidateSkill.class));
        verify(skillSuggestionRepository).deleteAll(List.of(clicked));
    }

    @Test
    void approveSuggestionRejetteUneCatégorieInconnue() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(UUID.randomUUID())
                .name("Figma").createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillRepository.findAll()).thenReturn(List.of(
                Skill.builder().name("Miro").skillType(SkillType.TECH).category("Design").build()));

        assertThatThrownBy(() -> adminService.approveSuggestion(suggestionId, "Game Design", "tech", adminId))
                .isInstanceOf(InvalidSkillCategoryException.class);
        verify(skillRepository, never()).save(any(Skill.class));
        verify(skillSuggestionRepository, never()).deleteAll(any());
    }

    @Test
    void approveSuggestionRejetteUnTypeInvalide() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(UUID.randomUUID())
                .name("Figma").createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));

        assertThatThrownBy(() -> adminService.approveSuggestion(suggestionId, "Design", "framework", adminId))
                .isInstanceOf(InvalidSkillTypeException.class);
        verify(skillRepository, never()).findAll();
        verify(skillSuggestionRepository, never()).deleteAll(any());
    }

    @Test
    void linkSuggestionInsereLeSkillExistantSansCreation() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();
        UUID adaId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(adaId).name("ReactJS")
                .createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        Skill react = Skill.builder().id(skillId).name("React")
                .skillType(SkillType.TECH).category("Frameworks & Libraries").build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillSuggestionRepository.findAllByNameIgnoreCase("ReactJS")).thenReturn(List.of(clicked));
        when(skillRepository.findById(skillId)).thenReturn(Optional.of(react));
        when(candidateSkillRepository.existsByCandidateIdAndSkillId(adaId, skillId)).thenReturn(false);
        when(candidateRepository.findById(adaId)).thenReturn(Optional.of(Candidate.builder().id(adaId).build()));
        when(candidateSkillRepository.save(any(CandidateSkill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        adminService.linkSuggestion(suggestionId, skillId, adminId);

        verify(skillRepository, never()).save(any(Skill.class));
        ArgumentCaptor<CandidateSkill> grantCaptor = ArgumentCaptor.forClass(CandidateSkill.class);
        verify(candidateSkillRepository).save(grantCaptor.capture());
        assertThat(grantCaptor.getValue().getSkill()).isSameAs(react);
        assertThat(grantCaptor.getValue().getLevel()).isEqualTo(1);
        verify(skillSuggestionRepository).deleteAll(List.of(clicked));
    }

    @Test
    void linkSuggestionRejetteUneCompetenceInconnue() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        UUID unknownSkillId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(UUID.randomUUID())
                .name("ReactJS").createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillRepository.findById(unknownSkillId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.linkSuggestion(suggestionId, unknownSkillId, adminId))
                .isInstanceOf(ReferenceNotFoundException.class);
        verify(skillSuggestionRepository, never()).deleteAll(any());
    }

    @Test
    void rejectSuggestionSupprimeLeGroupeHomonymeSansToucherAuxProfils() {
        UUID adminId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        SkillSuggestion clicked = SkillSuggestion.builder().id(suggestionId).candidateId(UUID.randomUUID())
                .name("Rust").createdAt(LocalDateTime.of(2026, 10, 5, 10, 0)).build();
        SkillSuggestion twin = SkillSuggestion.builder().id(UUID.randomUUID()).candidateId(UUID.randomUUID())
                .name("RUST").createdAt(LocalDateTime.of(2026, 10, 1, 10, 0)).build();
        when(skillSuggestionRepository.findById(suggestionId)).thenReturn(Optional.of(clicked));
        when(skillSuggestionRepository.findAllByNameIgnoreCase("Rust")).thenReturn(List.of(clicked, twin));

        adminService.rejectSuggestion(suggestionId, adminId);

        verify(skillSuggestionRepository).deleteAll(List.of(clicked, twin));
        verify(candidateSkillRepository, never()).save(any(CandidateSkill.class));
        verify(skillRepository, never()).save(any(Skill.class));
    }

    @Test
    void lesTroisDecisionsRejettentUneSuggestionInconnue() {
        UUID adminId = UUID.randomUUID();
        UUID unknownId = UUID.randomUUID();
        when(skillSuggestionRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.approveSuggestion(unknownId, "Design", "tech", adminId))
                .isInstanceOf(SuggestionNotFoundException.class);
        assertThatThrownBy(() -> adminService.linkSuggestion(unknownId, UUID.randomUUID(), adminId))
                .isInstanceOf(SuggestionNotFoundException.class);
        assertThatThrownBy(() -> adminService.rejectSuggestion(unknownId, adminId))
                .isInstanceOf(SuggestionNotFoundException.class);
        verify(skillSuggestionRepository, never()).deleteAll(any());
    }

    @Test
    void creeUneRevueUpheldAvecCorrectionsEtNettoieLesTextes() {
        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, UUID.randomUUID())));
        when(criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(false);
        when(criterionReportReviewRepository.saveAndFlush(any(MatchingCriterionReportReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AdminCriterionReportReviewResponse response = adminService.createCriterionReportReview(
                reportId, reviewerId,
                new CreateCriterionReportReviewRequest("upheld", "  note  ", 80, "  rationale  "));

        assertThat(response.verdict()).isEqualTo("upheld");
        assertThat(response.note()).isEqualTo("note");
        assertThat(response.correctedScore()).isEqualTo(80);
        assertThat(response.correctedRationale()).isEqualTo("rationale");
        ArgumentCaptor<MatchingCriterionReportReview> captor =
                ArgumentCaptor.forClass(MatchingCriterionReportReview.class);
        verify(criterionReportReviewRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getReportId()).isEqualTo(reportId);
        assertThat(captor.getValue().getReviewerUserId()).isEqualTo(reviewerId);
        assertThat(captor.getValue().getVerdict()).isEqualTo(CriterionReportReviewVerdict.UPHELD);
        assertThat(captor.getValue().getNote()).isEqualTo("note");
        assertThat(captor.getValue().getCorrectedScore()).isEqualTo(80);
        assertThat(captor.getValue().getCorrectedRationale()).isEqualTo("rationale");
    }

    @Test
    void creeUneRevueNotUpheldSansCorrectionEtNormaliseLesBlancs() {
        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, UUID.randomUUID())));
        when(criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(false);
        when(criterionReportReviewRepository.saveAndFlush(any(MatchingCriterionReportReview.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AdminCriterionReportReviewResponse response = adminService.createCriterionReportReview(
                reportId, reviewerId,
                new CreateCriterionReportReviewRequest("notUpheld", "  note  ", null, "   "));

        assertThat(response.verdict()).isEqualTo("notUpheld");
        assertThat(response.note()).isEqualTo("note");
        assertThat(response.correctedScore()).isNull();
        assertThat(response.correctedRationale()).isNull();
        verify(criterionReportReviewRepository).saveAndFlush(any(MatchingCriterionReportReview.class));
    }

    @Test
    void refuseLAutoReviewEtLeDoublon() {
        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, reviewerId)));

        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("upheld", null, null, null)))
                .isInstanceOf(CriterionReportReviewConflictException.class)
                .hasMessage("You cannot review your own report.");
        verify(criterionReportReviewRepository, never()).saveAndFlush(any());

        UUID authorId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, authorId)));
        when(criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(true);

        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("upheld", null, null, null)))
                .isInstanceOf(CriterionReportReviewConflictException.class)
                .hasMessage("You have already reviewed this report.");
        verify(criterionReportReviewRepository, never()).saveAndFlush(any());
    }

    @Test
    void refuseUnVerdictInconnuEtUneCorrectionIncoherente() {
        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, UUID.randomUUID())));
        when(criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(false);

        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("bogus", null, null, null)))
                .isInstanceOf(InvalidCriterionReportReviewException.class)
                .hasMessage("Verdict must be upheld or notUpheld.");
        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("notUpheld", null, 50, null)))
                .isInstanceOf(InvalidCriterionReportReviewException.class)
                .hasMessage("Corrected score and rationale are only allowed when the report is upheld.");
        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("notUpheld", null, null, "rationale")))
                .isInstanceOf(InvalidCriterionReportReviewException.class)
                .hasMessage("Corrected score and rationale are only allowed when the report is upheld.");
        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("upheld", null, 101, null)))
                .isInstanceOf(InvalidCriterionReportReviewException.class)
                .hasMessage("Corrected score must be between 0 and 100.");
        verify(criterionReportReviewRepository, never()).saveAndFlush(any());
    }

    @Test
    void refuseUneRevueSurUnSignalementInconnuEtTraduitLaCourseEnConflit() {
        UUID unknownId = UUID.randomUUID();
        when(criterionReportRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.createCriterionReportReview(unknownId, UUID.randomUUID(),
                new CreateCriterionReportReviewRequest("upheld", null, null, null)))
                .isInstanceOf(CriterionReportNotFoundException.class);

        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, UUID.randomUUID())));
        when(criterionReportReviewRepository.existsByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(false);
        when(criterionReportReviewRepository.saveAndFlush(any(MatchingCriterionReportReview.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> adminService.createCriterionReportReview(reportId, reviewerId,
                new CreateCriterionReportReviewRequest("upheld", null, null, null)))
                .isInstanceOf(CriterionReportReviewConflictException.class)
                .hasMessage("You have already reviewed this report.");
    }

    @Test
    void getCriterionReportExposeUniquementLaRevueDeLAdminCourant() {
        UUID reportId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        UUID otherReviewerId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        when(criterionReportRepository.findById(reportId))
                .thenReturn(Optional.of(criterionReport(reportId, authorId)));
        when(matchingRepository.findById(any())).thenReturn(Optional.empty());
        when(matchingResultRepository.findById(any())).thenReturn(Optional.empty());
        when(userRepository.findById(authorId)).thenReturn(Optional.empty());

        MatchingCriterionReportReview review = MatchingCriterionReportReview.builder()
                .id(UUID.randomUUID())
                .reportId(reportId)
                .reviewerUserId(reviewerId)
                .verdict(CriterionReportReviewVerdict.UPHELD)
                .note("my review")
                .correctedScore(85)
                .correctedRationale("my rationale")
                .build();
        when(criterionReportReviewRepository.findByReportIdAndReviewerUserId(reportId, reviewerId))
                .thenReturn(Optional.of(review));
        when(criterionReportReviewRepository.findByReportIdAndReviewerUserId(reportId, otherReviewerId))
                .thenReturn(Optional.empty());
        when(criterionReportReviewRepository.findByReportIdAndReviewerUserId(reportId, authorId))
                .thenReturn(Optional.empty());

        AdminCriterionReportDetailResponse mine = adminService.getCriterionReport(reportId, reviewerId);
        AdminCriterionReportDetailResponse other = adminService.getCriterionReport(reportId, otherReviewerId);
        AdminCriterionReportDetailResponse author = adminService.getCriterionReport(reportId, authorId);

        assertThat(mine.myReview()).isNotNull();
        assertThat(mine.canReview()).isFalse();
        assertThat(mine.myReview().id()).isEqualTo(review.getId());
        assertThat(mine.myReview().verdict()).isEqualTo("upheld");
        assertThat(mine.myReview().note()).isEqualTo("my review");
        assertThat(mine.myReview().correctedScore()).isEqualTo(85);
        assertThat(mine.myReview().correctedRationale()).isEqualTo("my rationale");
        assertThat(other.myReview()).isNull();
        assertThat(other.canReview()).isTrue();
        assertThat(author.myReview()).isNull();
        assertThat(author.canReview()).isFalse();
        verify(criterionReportReviewRepository).findByReportIdAndReviewerUserId(reportId, reviewerId);
        verify(criterionReportReviewRepository).findByReportIdAndReviewerUserId(reportId, otherReviewerId);
    }

    @Test
    void listCriterionReportsNeLitQueLeVerdictDeLAdminCourantEnUnSeulLot() {
        UUID reviewerId = UUID.randomUUID();
        UUID otherReviewerId = UUID.randomUUID();
        MatchingCriterionReport first = criterionReport(UUID.randomUUID(), UUID.randomUUID());
        MatchingCriterionReport second = criterionReport(UUID.randomUUID(), UUID.randomUUID());
        List<UUID> reportIds = List.of(first.getId(), second.getId());
        Pageable pageable = PageRequest.of(0, 20);
        when(criterionReportRepository.findAllByOrderByCreatedAtDescIdDesc(pageable))
                .thenReturn(new PageImpl<>(List.of(first, second), pageable, 2));
        when(matchingRepository.findAllById(anyList())).thenReturn(List.of());
        when(matchingResultRepository.findAllById(anyList())).thenReturn(List.of());
        when(userRepository.findAllById(anyList())).thenReturn(List.of());

        when(criterionReportReviewRepository.findByReviewerUserIdAndReportIdIn(reviewerId, reportIds))
                .thenReturn(List.of(MatchingCriterionReportReview.builder()
                        .id(UUID.randomUUID())
                        .reportId(first.getId())
                        .reviewerUserId(reviewerId)
                        .verdict(CriterionReportReviewVerdict.UPHELD)
                        .build()));
        when(criterionReportReviewRepository.findByReviewerUserIdAndReportIdIn(otherReviewerId, reportIds))
                .thenReturn(List.of(MatchingCriterionReportReview.builder()
                        .id(UUID.randomUUID())
                        .reportId(first.getId())
                        .reviewerUserId(otherReviewerId)
                        .verdict(CriterionReportReviewVerdict.NOT_UPHELD)
                        .build()));

        AdminCriterionReportPageResponse mine = adminService.listCriterionReports(0, null, reviewerId);
        AdminCriterionReportPageResponse other = adminService.listCriterionReports(0, null, otherReviewerId);

        assertThat(mine.items()).hasSize(2);
        assertThat(mine.items().get(0).myReviewVerdict()).isEqualTo("upheld");
        assertThat(mine.items().get(1).myReviewVerdict()).isNull();
        assertThat(other.items().get(0).myReviewVerdict()).isEqualTo("notUpheld");
        assertThat(other.items().get(1).myReviewVerdict()).isNull();
        verify(criterionReportReviewRepository).findByReviewerUserIdAndReportIdIn(reviewerId, reportIds);
        verify(criterionReportReviewRepository).findByReviewerUserIdAndReportIdIn(otherReviewerId, reportIds);
    }

    private static MatchingCriterionReport criterionReport(UUID reportId, UUID authorId) {
        return MatchingCriterionReport.builder()
                .id(reportId)
                .matchingId(UUID.randomUUID())
                .matchingResultId(UUID.randomUUID())
                .criterionKey("skill:java")
                .authorUserId(authorId)
                .reason(CriterionReportReason.SCORE_INCORRECT)
                .build();
    }

    @Test
    void getUserDetailRenvoieLaFicheCompleteSansHash() {
        UUID userId = UUID.randomUUID();
        UUID recruiterId = UUID.randomUUID();
        User user = User.builder().id(userId).email("ada@example.com")
                .firstName("Ada").lastName("Lovelace").status(UserStatus.ACTIVE)
                .phone("+33612345678").sex(UserSex.FEMALE).homeCountry("FR")
                .currentCity("Paris").currentCountry("FR")
                .createdAt(LocalDateTime.of(2026, 1, 15, 10, 0)).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(userId)).thenReturn(List.of(UserRole.of(userId, Role.ADMIN)));
        when(candidateRepository.existsById(userId)).thenReturn(true);
        when(recruiterRepository.existsById(recruiterId)).thenReturn(true);

        AdminUserDetailResponse detail = adminService.getUserDetail(userId);

        assertThat(detail.id()).isEqualTo(userId);
        assertThat(detail.email()).isEqualTo("ada@example.com");
        assertThat(detail.firstName()).isEqualTo("Ada");
        assertThat(detail.lastName()).isEqualTo("Lovelace");
        assertThat(detail.status()).isEqualTo("ACTIVE");
        assertThat(detail.roles()).containsExactly((short) 1);
        assertThat(detail.phone()).isEqualTo("+33612345678");
        assertThat(detail.sex()).isEqualTo("female");
        assertThat(detail.homeCountry()).isEqualTo("FR");
        assertThat(detail.currentCity()).isEqualTo("Paris");
        assertThat(detail.currentCountry()).isEqualTo("FR");
        assertThat(detail.createdAt()).isEqualTo(LocalDateTime.of(2026, 1, 15, 10, 0));
        assertThat(detail.hasCandidateProfile()).isTrue();
        assertThat(detail.hasRecruiterProfile()).isFalse();
    }

    @Test
    void getUserDetailRejetteUnCompteInconnu() {
        UUID unknownId = UUID.randomUUID();
        when(userRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.getUserDetail(unknownId))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getCandidateProfileDelegueAuServiceCandidatQuandLeCompteExiste() {
        UUID candidateId = UUID.randomUUID();
        CandidateProfileResponse profile = new CandidateProfileResponse(null, List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of(), 60, true, false, false, false);
        when(candidateRepository.existsById(candidateId)).thenReturn(true);
        when(candidateService.getProfile(candidateId)).thenReturn(profile);

        CandidateProfileResponse response = adminService.getCandidateProfile(candidateId);

        assertThat(response).isSameAs(profile);
        assertThat(response.completionPercentage()).isEqualTo(60);
        assertThat(response.hasUnvalidatedChanges()).isTrue();
        verify(candidateService).getProfile(candidateId);
    }

    @Test
    void getCandidateProfileRejetteUnCompteInconnuOuSansProfilCandidat() {
        UUID unknownId = UUID.randomUUID();
        when(candidateRepository.existsById(unknownId)).thenReturn(false);

        assertThatThrownBy(() -> adminService.getCandidateProfile(unknownId))
                .isInstanceOf(UserNotFoundException.class);
        verify(candidateService, never()).getProfile(any());
    }

    @Test
    void getCandidateNormalizedProfileParseLeContenuEtLeStatutDuJob() {
        UUID candidateId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        NormalizedProfile profile = NormalizedProfile.builder()
                .id(profileId).version(3).schemaVersion("2")
                .content("{\"seniority\":\"mid\"}")
                .validatedAt(LocalDateTime.of(2026, 10, 1, 12, 0)).build();
        when(candidateRepository.existsById(candidateId)).thenReturn(true);
        when(normalizedProfileRepository.findLatestByCandidateId(eq(candidateId), any(Pageable.class)))
                .thenReturn(List.of(profile));
        when(normalizationJobRepository.findById(profileId))
                .thenReturn(Optional.of(NormalizationJob.builder()
                        .id(profileId).status(NormalizationJobStatus.DONE).build()));

        AdminNormalizedProfileResponse response = adminService.getCandidateNormalizedProfile(candidateId);

        assertThat(response.profileId()).isEqualTo(profileId);
        assertThat(response.version()).isEqualTo(3);
        assertThat(response.schemaVersion()).isEqualTo("2");
        assertThat(response.jobStatus()).isEqualTo("done");
        assertThat(response.validatedAt()).isEqualTo(LocalDateTime.of(2026, 10, 1, 12, 0));
        assertThat(response.content()).isNotNull();
        assertThat(response.content().get("seniority").asString()).isEqualTo("mid");
    }

    @Test
    void getCandidateNormalizedProfileRejetteUnCompteNonCandidat() {
        UUID unknownId = UUID.randomUUID();
        when(candidateRepository.existsById(unknownId)).thenReturn(false);

        assertThatThrownBy(() -> adminService.getCandidateNormalizedProfile(unknownId))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getCandidateNormalizedProfileRejetteUnCompteSansFiche() {
        UUID candidateId = UUID.randomUUID();
        when(candidateRepository.existsById(candidateId)).thenReturn(true);
        when(normalizedProfileRepository.findLatestByCandidateId(eq(candidateId), any(Pageable.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> adminService.getCandidateNormalizedProfile(candidateId))
                .isInstanceOf(NormalizedProfileNotFoundException.class);
    }

    @Test
    void getOfferNormalizedProfileParseLeContenuEtLeStatutDuJob() {
        UUID offerId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        NormalizedProfile profile = NormalizedProfile.builder()
                .id(profileId).version(1).schemaVersion("1")
                .content("{\"title\":\"Dev Java\"}")
                .validatedAt(LocalDateTime.of(2026, 10, 2, 9, 0)).build();
        when(jobOfferRepository.existsById(offerId)).thenReturn(true);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(eq(offerId), any(Pageable.class)))
                .thenReturn(List.of(profile));
        when(normalizationJobRepository.findById(profileId))
                .thenReturn(Optional.of(NormalizationJob.builder()
                        .id(profileId).status(NormalizationJobStatus.FAILED).build()));

        AdminNormalizedProfileResponse response = adminService.getOfferNormalizedProfile(offerId);

        assertThat(response.profileId()).isEqualTo(profileId);
        assertThat(response.version()).isEqualTo(1);
        assertThat(response.schemaVersion()).isEqualTo("1");
        assertThat(response.jobStatus()).isEqualTo("failed");
        assertThat(response.content().get("title").asString()).isEqualTo("Dev Java");
    }

    @Test
    void getOfferNormalizedProfileRejetteUneOffreInconnue() {
        UUID unknownId = UUID.randomUUID();
        when(jobOfferRepository.existsById(unknownId)).thenReturn(false);

        assertThatThrownBy(() -> adminService.getOfferNormalizedProfile(unknownId))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void getOfferNormalizedProfileRejetteUneOffreSansFiche() {
        UUID offerId = UUID.randomUUID();
        when(jobOfferRepository.existsById(offerId)).thenReturn(true);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(eq(offerId), any(Pageable.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> adminService.getOfferNormalizedProfile(offerId))
                .isInstanceOf(NormalizedProfileNotFoundException.class);
    }

    @Test
    void getCandidateNormalizedProfileVersionsMappeToutesLesVersionsDecroissantes() {
        UUID candidateId = UUID.randomUUID();
        UUID profileIdV3 = UUID.randomUUID();
        UUID profileIdV2 = UUID.randomUUID();
        NormalizedProfile v3 = NormalizedProfile.builder()
                .id(profileIdV3).version(3).schemaVersion("2")
                .content("{\"seniority\":\"mid\"}")
                .validatedAt(LocalDateTime.of(2026, 10, 1, 12, 0)).build();
        NormalizedProfile v2 = NormalizedProfile.builder()
                .id(profileIdV2).version(2).schemaVersion("2")
                .content("{\"seniority\":\"junior\"}")
                .validatedAt(LocalDateTime.of(2026, 9, 1, 12, 0)).build();
        when(candidateRepository.existsById(candidateId)).thenReturn(true);
        when(normalizedProfileRepository.findLatestByCandidateId(eq(candidateId), eq(Pageable.unpaged())))
                .thenReturn(List.of(v3, v2));
        when(normalizationJobRepository.findById(profileIdV3))
                .thenReturn(Optional.of(NormalizationJob.builder()
                        .id(profileIdV3).status(NormalizationJobStatus.DONE).build()));
        when(normalizationJobRepository.findById(profileIdV2)).thenReturn(Optional.empty());

        List<AdminNormalizedProfileResponse> versions =
                adminService.getCandidateNormalizedProfileVersions(candidateId);

        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).version()).isEqualTo(3);
        assertThat(versions.get(0).schemaVersion()).isEqualTo("2");
        assertThat(versions.get(0).content().get("seniority").asString()).isEqualTo("mid");
        assertThat(versions.get(0).jobStatus()).isEqualTo("done");
        assertThat(versions.get(1).version()).isEqualTo(2);
        assertThat(versions.get(1).content().get("seniority").asString()).isEqualTo("junior");
        assertThat(versions.get(1).jobStatus()).isNull();
        verify(normalizedProfileRepository).findLatestByCandidateId(eq(candidateId), eq(Pageable.unpaged()));
    }

    @Test
    void getCandidateNormalizedProfileVersionsRejetteUnCompteNonCandidat() {
        UUID unknownId = UUID.randomUUID();
        when(candidateRepository.existsById(unknownId)).thenReturn(false);

        assertThatThrownBy(() -> adminService.getCandidateNormalizedProfileVersions(unknownId))
                .isInstanceOf(UserNotFoundException.class);
    }

    @Test
    void getCandidateNormalizedProfileVersionsRejetteUnCompteSansFiche() {
        UUID candidateId = UUID.randomUUID();
        when(candidateRepository.existsById(candidateId)).thenReturn(true);
        when(normalizedProfileRepository.findLatestByCandidateId(eq(candidateId), any(Pageable.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> adminService.getCandidateNormalizedProfileVersions(candidateId))
                .isInstanceOf(NormalizedProfileNotFoundException.class);
    }

    @Test
    void getOfferNormalizedProfileVersionsMappeToutesLesVersionsDecroissantes() {
        UUID offerId = UUID.randomUUID();
        UUID profileIdV2 = UUID.randomUUID();
        UUID profileIdV1 = UUID.randomUUID();
        NormalizedProfile v2 = NormalizedProfile.builder()
                .id(profileIdV2).version(2).schemaVersion("1")
                .content("{\"title\":\"Dev Java\"}")
                .validatedAt(LocalDateTime.of(2026, 10, 2, 9, 0)).build();
        NormalizedProfile v1 = NormalizedProfile.builder()
                .id(profileIdV1).version(1).schemaVersion("1")
                .content("{\"title\":\"Dev\"}")
                .validatedAt(LocalDateTime.of(2026, 9, 2, 9, 0)).build();
        when(jobOfferRepository.existsById(offerId)).thenReturn(true);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(eq(offerId), eq(Pageable.unpaged())))
                .thenReturn(List.of(v2, v1));
        when(normalizationJobRepository.findById(profileIdV2))
                .thenReturn(Optional.of(NormalizationJob.builder()
                        .id(profileIdV2).status(NormalizationJobStatus.FAILED).build()));
        when(normalizationJobRepository.findById(profileIdV1)).thenReturn(Optional.empty());

        List<AdminNormalizedProfileResponse> versions =
                adminService.getOfferNormalizedProfileVersions(offerId);

        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).version()).isEqualTo(2);
        assertThat(versions.get(0).content().get("title").asString()).isEqualTo("Dev Java");
        assertThat(versions.get(0).jobStatus()).isEqualTo("failed");
        assertThat(versions.get(1).version()).isEqualTo(1);
        assertThat(versions.get(1).content().get("title").asString()).isEqualTo("Dev");
        assertThat(versions.get(1).jobStatus()).isNull();
        verify(normalizedProfileJobOfferRepository).findLatestByOfferId(eq(offerId), eq(Pageable.unpaged()));
    }

    @Test
    void getOfferNormalizedProfileVersionsRejetteUneOffreInconnue() {
        UUID unknownId = UUID.randomUUID();
        when(jobOfferRepository.existsById(unknownId)).thenReturn(false);

        assertThatThrownBy(() -> adminService.getOfferNormalizedProfileVersions(unknownId))
                .isInstanceOf(JobOfferNotFoundException.class);
    }

    @Test
    void getOfferNormalizedProfileVersionsRejetteUneOffreSansFiche() {
        UUID offerId = UUID.randomUUID();
        when(jobOfferRepository.existsById(offerId)).thenReturn(true);
        when(normalizedProfileJobOfferRepository.findLatestByOfferId(eq(offerId), any(Pageable.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> adminService.getOfferNormalizedProfileVersions(offerId))
                .isInstanceOf(NormalizedProfileNotFoundException.class);
    }

    private static JobOfferRow row(UUID id, UUID companyId, JobOfferStatus status) {
        return new JobOfferRow(id, companyId, "Dev Java", status, "abc123", "dev-java",
                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 9, 0),
                LocalDate.of(2026, 12, 31), LocalDateTime.of(2026, 10, 1, 10, 0), null, Seniority.MID,
                "Paris", "FR", null, null, ROW_EMPLOYMENT_TYPE_ID, new BigDecimal("50000"),
                new BigDecimal("70000"), "EUR", SalaryPeriod.YEAR);
    }

    private static final UUID ROW_EMPLOYMENT_TYPE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000e1");

    private static Page<JobOfferRow> rows(Pageable pageable, long total, JobOfferRow... rows) {
        return new PageImpl<>(List.of(rows), pageable, total);
    }

    private JobOfferSearch capturedSearch(Pageable[] pageable) {
        ArgumentCaptor<JobOfferSearch> searchCaptor = ArgumentCaptor.forClass(JobOfferSearch.class);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(jobOfferSearchRepository).searchRows(searchCaptor.capture(), pageableCaptor.capture());
        pageable[0] = pageableCaptor.getValue();
        return searchCaptor.getValue();
    }

    @Test
    void listJobOffersSansFiltreJointLesNomsDEntreprisesEtLeStatutDeNormalisation() {
        UUID offerId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 1, row(offerId, companyId, JobOfferStatus.PUBLISHED)));
        when(companyRepository.findAllById(any())).thenReturn(List.of(
                Company.builder().id(companyId).name("Acme").build()));
        when(normalizedProfileJobOfferRepository.findLatestJobStatuses(anyList()))
                .thenReturn(List.<Object[]>of(new Object[] { offerId, NormalizationJobStatus.DONE }));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, 0, 20);

        assertThat(response.items()).hasSize(1);
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(20);
        assertThat(response.total()).isEqualTo(1);
        AdminJobOfferListItem item = response.items().get(0);
        assertThat(item.id()).isEqualTo(offerId);
        assertThat(item.title()).isEqualTo("Dev Java");
        assertThat(item.status()).isEqualTo("published");
        assertThat(item.companyName()).isEqualTo("Acme");
        assertThat(item.publicId()).isEqualTo("abc123");
        assertThat(item.slug()).isEqualTo("dev-java");
        assertThat(item.expiresAt()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(item.publishedAt()).isEqualTo(LocalDateTime.of(2026, 10, 1, 10, 0));
        assertThat(item.seniority()).isEqualTo("mid");
        assertThat(item.city()).isEqualTo("Paris");
        assertThat(item.country()).isEqualTo("FR");
        assertThat(item.employmentTypeId()).isEqualTo(ROW_EMPLOYMENT_TYPE_ID);
        assertThat(item.salaryMin()).isEqualByComparingTo("50000");
        assertThat(item.salaryMax()).isEqualByComparingTo("70000");
        assertThat(item.salaryCurrency()).isEqualTo("EUR");
        assertThat(item.salaryPeriod()).isEqualTo("year");
        assertThat(item.hasUnvalidatedChanges()).isFalse();
        assertThat(item.normalizationJobStatus()).isEqualTo("done");
    }

    @Test
    void listJobOffersSansFiltreNeRestreintRien() {
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 0));

        adminService.listJobOffers(JobOfferListFilters.none(), 0, 20);

        JobOfferSearch search = capturedSearch(new Pageable[1]);
        assertThat(search.companyIds()).isNull();
        assertThat(search.status()).isNull();
        assertThat(search.publicToday()).isNull();
        assertThat(search.workModeId()).isNull();
        assertThat(search.contractTypeId()).isNull();
        assertThat(search.employmentTypeId()).isNull();
        assertThat(search.seniority()).isNull();
        assertThat(search.country()).isNull();
        assertThat(search.titlePattern()).isNull();
        assertThat(search.expiresFrom()).isNull();
        assertThat(search.expiresUntil()).isNull();
        assertThat(search.order()).isEqualTo(JobOfferSearch.Order.CREATED_DESC);
    }

    @Test
    void listJobOffersMarqueLeDirtyFlagSurStatutEditable() {
        UUID offerId = UUID.randomUUID();
        JobOfferRow dirty = new JobOfferRow(offerId, UUID.randomUUID(), "Dev Java", JobOfferStatus.VALIDATED,
                "abc123", "dev-java", null, LocalDateTime.of(2026, 10, 2, 8, 0), null, null,
                LocalDateTime.of(2026, 10, 1, 8, 0), null, null, null, null, null, null, null, null, null, null);
        JobOfferRow published = new JobOfferRow(UUID.randomUUID(), UUID.randomUUID(), "Dev Java",
                JobOfferStatus.PUBLISHED, "abc124", "dev-java", null, LocalDateTime.of(2026, 10, 2, 8, 0), null,
                null, LocalDateTime.of(2026, 10, 1, 8, 0), null, null, null, null, null, null, null, null, null, null);
        JobOfferRow neverValidated = new JobOfferRow(UUID.randomUUID(), UUID.randomUUID(), "Dev Java",
                JobOfferStatus.DRAFT, "abc125", "dev-java", null, LocalDateTime.of(2026, 10, 2, 8, 0), null, null,
                null, null, null, null, null, null, null, null, null, null, null);
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 3, dirty, published, neverValidated));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, 0, 20);

        assertThat(response.items()).extracting(AdminJobOfferListItem::hasUnvalidatedChanges)
                .containsExactly(true, false, false);
    }

    @Test
    void listJobOffersAccepteLeStatutEnCasseMajusculeEtAvecBlancs() {
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(1, 20), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(
                new JobOfferListFilters(null, " PUBLISHED ", null, null, null, null, null, null), 1, 20);

        assertThat(response.items()).isEmpty();
        assertThat(response.page()).isEqualTo(1);
        assertThat(capturedSearch(new Pageable[1]).status()).isEqualTo(JobOfferStatus.PUBLISHED);
    }

    @Test
    void listJobOffersTraiteUnStatutVideOuBlancCommeAbsent() {
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 0));

        adminService.listJobOffers(new JobOfferListFilters(null, "   ", null, null, null, null, null, null), 0, 20);
        adminService.listJobOffers(new JobOfferListFilters(null, "", null, null, null, null, null, null), 0, 20);

        ArgumentCaptor<JobOfferSearch> searchCaptor = ArgumentCaptor.forClass(JobOfferSearch.class);
        verify(jobOfferSearchRepository, org.mockito.Mockito.times(2))
                .searchRows(searchCaptor.capture(), any(Pageable.class));
        assertThat(searchCaptor.getAllValues()).allSatisfy(search -> assertThat(search.status()).isNull());
    }

    @Test
    void listJobOffersRejetteUnStatutInconnuAvantToutelecture() {
        assertThatThrownBy(() -> adminService.listJobOffers(
                new JobOfferListFilters(null, "archived", null, null, null, null, null, null), 0, 20))
                .isInstanceOf(InvalidOfferStatusFilterException.class);
        verify(jobOfferSearchRepository, never()).searchRows(any(), any());
    }

    @Test
    void listJobOffersRejetteUneSenioriteOuUneEcheanceInconnue() {
        assertThatThrownBy(() -> adminService.listJobOffers(
                new JobOfferListFilters(null, null, null, null, null, "wizard", null, null), 0, 20))
                .isInstanceOf(InvalidJobOfferFilterException.class);
        assertThatThrownBy(() -> adminService.listJobOffers(
                new JobOfferListFilters(null, null, null, null, null, null, null, "someday"), 0, 20))
                .isInstanceOf(InvalidJobOfferFilterException.class);
        verify(jobOfferSearchRepository, never()).searchRows(any(), any());
    }

    @Test
    void listJobOffersTransmetChaqueFiltreAuRepositoryEtCherchePartoutDansLaSociete() {
        UUID workMode = UUID.randomUUID();
        UUID contract = UUID.randomUUID();
        UUID employment = UUID.randomUUID();
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 0));

        adminService.listJobOffers(new JobOfferListFilters(" Acme_100% ", "draft", workMode, contract, employment,
                " SENIOR ", UUID.randomUUID(), "expiringSoon"), 0, 20);

        JobOfferSearch search = capturedSearch(new Pageable[1]);
        assertThat(search.status()).isEqualTo(JobOfferStatus.DRAFT);
        assertThat(search.workModeId()).isEqualTo(workMode);
        assertThat(search.contractTypeId()).isEqualTo(contract);
        assertThat(search.employmentTypeId()).isEqualTo(employment);
        assertThat(search.seniority()).isEqualTo(Seniority.SENIOR);
        assertThat(search.titlePattern()).isEqualTo("%acme!_100!%%");
        assertThat(search.matchCompanyName()).isTrue();
        assertThat(search.expiresFrom()).isEqualTo(LocalDate.now());
        assertThat(search.expiresUntil()).isEqualTo(LocalDate.now().plusDays(30));
        // La console admin ne restreint jamais par société, même si l'appelant en passe une.
        assertThat(search.companyIds()).isNull();
    }

    @Test
    void listJobOffersBorneLaPagination() {
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 50), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, -5, 500);

        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(50);
        Pageable[] pageable = new Pageable[1];
        capturedSearch(pageable);
        assertThat(pageable[0].getPageNumber()).isZero();
        assertThat(pageable[0].getPageSize()).isEqualTo(50);
    }

    @Test
    void listJobOffersAppliqueLaTailleParDefaut() {
        when(jobOfferSearchRepository.searchRows(any(JobOfferSearch.class), any(Pageable.class)))
                .thenReturn(rows(PageRequest.of(0, 20), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, 0, null);

        assertThat(response.size()).isEqualTo(20);
        Pageable[] pageable = new Pageable[1];
        capturedSearch(pageable);
        assertThat(pageable[0].getPageSize()).isEqualTo(20);
    }

    @Test
    void getJobOfferDetailDelegueAuServicePublic() {
        UUID offerId = UUID.randomUUID();
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 1, 8, 0);
        LocalDateTime updatedAt = LocalDateTime.of(2026, 9, 2, 9, 0);
        when(jobOfferService.getAdminView(offerId)).thenReturn(new JobOfferAdminView(
                offerId, "published", createdAt, updatedAt, null));

        AdminJobOfferDetailResponse response = adminService.getJobOfferDetail(offerId);

        assertThat(response.id()).isEqualTo(offerId);
        assertThat(response.status()).isEqualTo("published");
        assertThat(response.createdAt()).isEqualTo(createdAt);
        assertThat(response.updatedAt()).isEqualTo(updatedAt);
        assertThat(response.detail()).isNull();
        verify(jobOfferService).getAdminView(offerId);
    }
}
