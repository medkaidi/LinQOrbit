package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.linqorbit.admin.dto.AdminJobOfferDetailResponse;
import com.linqorbit.admin.dto.AdminJobOfferListItem;
import com.linqorbit.admin.dto.AdminJobOfferPageResponse;
import com.linqorbit.admin.dto.AdminNormalizedProfileResponse;
import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserDetailResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidOfferStatusFilterException;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.NormalizedProfileNotFoundException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.NormalizationJob;
import com.linqorbit.candidate.entity.NormalizationJobStatus;
import com.linqorbit.candidate.entity.NormalizedProfile;
import com.linqorbit.candidate.repository.CandidateRepository;
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
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.repository.JobOfferRepository;
import com.linqorbit.joboffer.repository.NormalizedProfileJobOfferRepository;
import com.linqorbit.joboffer.service.JobOfferService;
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
    private JobOfferService jobOfferService;
    private CompanyRepository companyRepository;
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
        jobOfferService = mock(JobOfferService.class);
        companyRepository = mock(CompanyRepository.class);
        adminService = new AdminService(userRepository, userRoleRepository, skillSuggestionRepository,
                skillRepository, candidateRepository, candidateSkillRepository, recruiterRepository,
                normalizedProfileRepository, normalizedProfileJobOfferRepository,
                normalizationJobRepository, jobOfferRepository, jobOfferService, companyRepository,
                new ObjectMapper());
    }

    @Test
    void listUsersRetourneLesComptesAvecStatutEtRoles() {
        User ada = User.builder().id(UUID.randomUUID()).email("ada@example.com")
                .firstName("Ada").lastName("Lovelace").status(UserStatus.ACTIVE).build();
        User bob = User.builder().id(UUID.randomUUID()).email("bob@example.com")
                .firstName("Bob").lastName("Morris").status(UserStatus.INACTIVE).build();
        when(userRepository.findAllByOrderByLastNameAscFirstNameAsc()).thenReturn(List.of(ada, bob));
        when(userRoleRepository.findAll()).thenReturn(List.of(
                UserRole.of(ada.getId(), Role.ADMIN)));

        List<AdminUserResponse> users = adminService.listUsers();

        assertThat(users).hasSize(2);
        assertThat(users.get(0).email()).isEqualTo("ada@example.com");
        assertThat(users.get(0).status()).isEqualTo("ACTIVE");
        assertThat(users.get(0).roles()).containsExactly((short) 1);
        assertThat(users.get(1).status()).isEqualTo("INACTIVE");
        assertThat(users.get(1).roles()).isEmpty();
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
    void listJobOffersSansFiltreAppelleFindAllEtJointLesNomsDEntreprises() {
        UUID offerId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        JobOffer offer = JobOffer.builder().id(offerId).companyId(companyId)
                .status(JobOfferStatus.PUBLISHED).title("Dev Java").publicId("abc123")
                .slug("dev-java").createdAt(LocalDateTime.of(2026, 10, 1, 8, 0))
                .updatedAt(LocalDateTime.of(2026, 10, 1, 9, 0))
                .expiresAt(LocalDate.of(2026, 12, 31))
                .publishedAt(LocalDateTime.of(2026, 10, 1, 10, 0)).build();
        Page<JobOffer> page = new PageImpl<>(List.of(offer),
                PageRequest.of(0, 20, org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "createdAt")),
                1);
        when(jobOfferRepository.findAll(any(Pageable.class))).thenReturn(page);
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
        assertThat(item.normalizationJobStatus()).isEqualTo("done");
    }

    @Test
    void listJobOffersAvecFiltreAppelleFindByStatus() {
        when(jobOfferRepository.findByStatus(eq(JobOfferStatus.PUBLISHED), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(1, 20), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(" published ", 1, 20);

        assertThat(response.items()).isEmpty();
        assertThat(response.page()).isEqualTo(1);
        verify(jobOfferRepository, never()).findAll(any(Pageable.class));
    }

    @Test
    void listJobOffersRejetteUnFiltreInconnu() {
        assertThatThrownBy(() -> adminService.listJobOffers("archived", 0, 20))
                .isInstanceOf(InvalidOfferStatusFilterException.class);
        verify(jobOfferRepository, never()).findAll(any(Pageable.class));
        verify(jobOfferRepository, never()).findByStatus(any(), any());
    }

    @Test
    void listJobOffersBorneLaPagination() {
        when(jobOfferRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 50), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, -5, 500);

        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(50);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(jobOfferRepository).findAll(pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageNumber()).isZero();
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(50);
    }

    @Test
    void listJobOffersAppliqueLaTailleParDefaut() {
        when(jobOfferRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        AdminJobOfferPageResponse response = adminService.listJobOffers(null, 0, null);

        assertThat(response.size()).isEqualTo(20);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(jobOfferRepository).findAll(pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(20);
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
