package com.linqorbit.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.linqorbit.admin.dto.AdminSkillSuggestionResponse;
import com.linqorbit.admin.dto.AdminUserResponse;
import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.candidate.Candidate;
import com.linqorbit.candidate.CandidateRepository;
import com.linqorbit.candidate.SkillType;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.SkillSuggestion;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.SkillSuggestionRepository;
import com.linqorbit.user.Role;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserRole;
import com.linqorbit.user.UserRoleRepository;
import com.linqorbit.user.UserStatus;

class AdminServiceTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private SkillSuggestionRepository skillSuggestionRepository;
    private SkillRepository skillRepository;
    private CandidateRepository candidateRepository;
    private CandidateSkillRepository candidateSkillRepository;
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        skillSuggestionRepository = mock(SkillSuggestionRepository.class);
        skillRepository = mock(SkillRepository.class);
        candidateRepository = mock(CandidateRepository.class);
        candidateSkillRepository = mock(CandidateSkillRepository.class);
        adminService = new AdminService(userRepository, userRoleRepository, skillSuggestionRepository,
                skillRepository, candidateRepository, candidateSkillRepository);
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
}
