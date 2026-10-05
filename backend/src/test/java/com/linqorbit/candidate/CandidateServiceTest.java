package com.linqorbit.candidate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import com.linqorbit.candidate.dto.AboutRequest;
import com.linqorbit.candidate.dto.AboutResponse;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.DiplomaRequest;
import com.linqorbit.candidate.dto.ExperienceRequest;
import com.linqorbit.candidate.dto.LanguageRequest;
import com.linqorbit.candidate.dto.LinkRequest;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillRequest;
import com.linqorbit.candidate.dto.TargetPositionRequest;
import com.linqorbit.candidate.entity.CandidateLanguage;
import com.linqorbit.candidate.entity.CandidateLink;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Diploma;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.ProfessionalExperience;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.exception.InvalidProfileSectionException;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.candidate.mapper.CandidateMapper;
import com.linqorbit.candidate.repository.CandidateLanguageRepository;
import com.linqorbit.candidate.repository.CandidateLinkRepository;
import com.linqorbit.candidate.repository.CandidateSkillRepository;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.DiplomaRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.ProfessionalExperienceRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;

class CandidateServiceTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");

    private CandidateRepository candidateRepository;
    private ProfessionalExperienceRepository experienceRepository;
    private DiplomaRepository diplomaRepository;
    private CandidateSkillRepository candidateSkillRepository;
    private CandidateLanguageRepository candidateLanguageRepository;
    private CandidateLinkRepository candidateLinkRepository;
    private SkillRepository skillRepository;
    private LanguageRepository languageRepository;
    private DegreeRepository degreeRepository;
    private StudyFieldRepository studyFieldRepository;
    private CandidateMapper candidateMapper;
    private CandidateService candidateService;

    @BeforeEach
    void setUp() {
        candidateRepository = mock(CandidateRepository.class);
        experienceRepository = mock(ProfessionalExperienceRepository.class);
        diplomaRepository = mock(DiplomaRepository.class);
        candidateSkillRepository = mock(CandidateSkillRepository.class);
        candidateLanguageRepository = mock(CandidateLanguageRepository.class);
        candidateLinkRepository = mock(CandidateLinkRepository.class);
        skillRepository = mock(SkillRepository.class);
        languageRepository = mock(LanguageRepository.class);
        degreeRepository = mock(DegreeRepository.class);
        studyFieldRepository = mock(StudyFieldRepository.class);
        candidateMapper = mock(CandidateMapper.class);
        candidateService = new CandidateService(candidateRepository, experienceRepository, diplomaRepository,
                candidateSkillRepository, candidateLanguageRepository, candidateLinkRepository,
                skillRepository, languageRepository, degreeRepository, studyFieldRepository, candidateMapper);
    }

    @Test
    void lectureSansProfilRenvoieUnProfilVideSansAucuneEcriture() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.empty());

        CandidateProfileResponse profile = candidateService.getProfile(USER_ID);

        assertThat(profile.about().title()).isNull();
        assertThat(profile.about().searchStatus()).isNull();
        assertThat(profile.experiences()).isEmpty();
        assertThat(profile.diplomas()).isEmpty();
        assertThat(profile.skills()).isEmpty();
        assertThat(profile.languages()).isEmpty();
        assertThat(profile.links()).isEmpty();
        assertThat(profile.completionPercentage()).isZero();
        verifyNoInteractions(candidateMapper, experienceRepository, diplomaRepository,
                candidateSkillRepository, candidateLanguageRepository, candidateLinkRepository);
    }

    @Test
    void lectureAvecProfilRemplitCalculeCentPourCent() {
        Candidate candidate = Candidate.builder().id(USER_ID).title("Dev").bio("Bio").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        when(candidateMapper.toAboutResponse(candidate))
                .thenReturn(new AboutResponse("Dev", "Staff Engineer", "Bio", 5, "open_to_work"));
        when(experienceRepository.findByCandidateIdOrderBySortOrderAsc(USER_ID))
                .thenReturn(List.of(mock(ProfessionalExperience.class)));
        when(diplomaRepository.findByCandidateId(USER_ID)).thenReturn(List.of(mock(Diploma.class)));
        when(candidateSkillRepository.findByCandidateId(USER_ID)).thenReturn(List.of(mock(CandidateSkill.class)));
        when(candidateLanguageRepository.findByCandidateId(USER_ID))
                .thenReturn(List.of(mock(CandidateLanguage.class)));
        when(candidateLinkRepository.findByCandidateIdOrderBySortOrderAsc(USER_ID))
                .thenReturn(List.of(mock(CandidateLink.class)));

        CandidateProfileResponse profile = candidateService.getProfile(USER_ID);

        assertThat(profile.about().title()).isEqualTo("Dev");
        assertThat(profile.about().targetPosition()).isEqualTo("Staff Engineer");
        assertThat(profile.about().searchStatus()).isEqualTo("open_to_work");
        assertThat(profile.completionPercentage()).isEqualTo(100);
    }

    @Test
    void lectureSansBioCompteLaSectionAboutCommeIncomplète() {
        Candidate candidate = Candidate.builder().id(USER_ID).title("Dev").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        when(candidateMapper.toAboutResponse(candidate))
                .thenReturn(new AboutResponse("Dev", null, null, null, "selective"));
        when(experienceRepository.findByCandidateIdOrderBySortOrderAsc(USER_ID)).thenReturn(List.of());
        when(diplomaRepository.findByCandidateId(USER_ID)).thenReturn(List.of());
        when(candidateSkillRepository.findByCandidateId(USER_ID)).thenReturn(List.of());
        when(candidateLanguageRepository.findByCandidateId(USER_ID)).thenReturn(List.of());
        when(candidateLinkRepository.findByCandidateIdOrderBySortOrderAsc(USER_ID)).thenReturn(List.of());

        CandidateProfileResponse profile = candidateService.getProfile(USER_ID);

        assertThat(profile.completionPercentage()).isZero();
    }

    @Test
    void premiereEcritureCreeLaLigneCandidatesAvecLIdentiteDuCompte() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(candidateRepository.save(any(Candidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        candidateService.updateAbout(USER_ID,
                new AboutRequest("Full-stack Developer", "  Bio  ", 5, "open_to_work"));

        ArgumentCaptor<Candidate> captor = ArgumentCaptor.forClass(Candidate.class);
        verify(candidateRepository).save(captor.capture());
        Candidate saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(USER_ID);
        assertThat(saved.getTitle()).isEqualTo("Full-stack Developer");
        assertThat(saved.getBio()).isEqualTo("Bio");
        assertThat(saved.getYearsOfExperience()).isEqualTo(5);
        assertThat(saved.getSearchStatus()).isEqualTo(SearchStatus.OPEN_TO_WORK);
    }

    @Test
    void miseAJourAboutRejetteUnStatutDeRechercheInconnu() {
        assertThatThrownBy(() -> candidateService.updateAbout(USER_ID,
                new AboutRequest("Dev", null, null, "nimporte-quoi")))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("search status");
        verify(candidateRepository, never()).save(any(Candidate.class));
    }

    @Test
    void miseAJourAboutNEffacePasLePosteRecherche() {
        Candidate candidate = Candidate.builder().id(USER_ID).title("Dev")
                .targetPosition("Staff Engineer").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any(Candidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        candidateService.updateAbout(USER_ID,
                new AboutRequest("Full-stack Developer", "Bio", 5, "open_to_work"));

        verify(candidateRepository).save(candidate);
        assertThat(candidate.getTargetPosition()).isEqualTo("Staff Engineer");
    }

    @Test
    void posteRechercheEstNormaliseAvantEnregistrement() {
        Candidate candidate = Candidate.builder().id(USER_ID).title("Dev").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any(Candidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        candidateService.updateTargetPosition(USER_ID, new TargetPositionRequest("  Staff Engineer  "));

        verify(candidateRepository).save(candidate);
        assertThat(candidate.getTargetPosition()).isEqualTo("Staff Engineer");
    }

    @Test
    void posteRechercheVideEffaceLaValeurEnregistree() {
        Candidate candidate = Candidate.builder().id(USER_ID).targetPosition("Ancien poste").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any(Candidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        candidateService.updateTargetPosition(USER_ID, new TargetPositionRequest("   "));

        verify(candidateRepository).save(candidate);
        assertThat(candidate.getTargetPosition()).isNull();
    }

    @Test
    void premierPosteRechercheCreeLaLigneCandidates() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.empty());
        when(candidateRepository.save(any(Candidate.class))).thenAnswer(invocation -> invocation.getArgument(0));

        candidateService.updateTargetPosition(USER_ID, new TargetPositionRequest("Staff Engineer"));

        ArgumentCaptor<Candidate> captor = ArgumentCaptor.forClass(Candidate.class);
        verify(candidateRepository, atLeastOnce()).save(captor.capture());
        Candidate saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(USER_ID);
        assertThat(saved.getTargetPosition()).isEqualTo("Staff Engineer");
    }

    @Test
    void experienceRemplaceLintegraleteDeLaListeDansLOrdreFourni() {
        Candidate candidate = Candidate.builder().id(USER_ID).title("Dev").build();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));

        candidateService.updateExperiences(USER_ID, List.of(
                experience("Developer", "2022-01-01", "2023-01-01"),
                experience("Lead Developer", "2023-01-01", null)));

        ArgumentCaptor<List<ProfessionalExperience>> captor = ArgumentCaptor.forClass(List.class);
        InOrder inOrder = inOrder(experienceRepository);
        inOrder.verify(experienceRepository).deleteAllByCandidateId(USER_ID);
        inOrder.verify(experienceRepository).saveAll(captor.capture());

        List<ProfessionalExperience> saved = captor.getValue();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getSortOrder()).isZero();
        assertThat(saved.get(1).getSortOrder()).isEqualTo(1);
        assertThat(saved.get(0).getCandidate()).isSameAs(candidate);
        assertThat(saved.get(1).getEndDate()).isNull();
    }

    @Test
    void experienceRejetteUneDateDeFinAvantLeDebut() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate()));

        assertThatThrownBy(() -> candidateService.updateExperiences(USER_ID, List.of(
                experience("Developer", "2023-01-01", "2022-01-01"))))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("start date");
        verify(experienceRepository, never()).deleteAllByCandidateId(any());
    }

    @Test
    void diplomasRejetteUnNiveauDeDiplomeInconnu() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate()));
        when(degreeRepository.findById(any())).thenReturn(Optional.empty());

        UUID unknown = UUID.randomUUID();
        assertThatThrownBy(() -> candidateService.updateDiplomas(USER_ID, List.of(
                new DiplomaRequest("Master", LocalDate.of(2020, 9, 1), LocalDate.of(2022, 6, 30),
                        "Université de Paris", "FR", unknown, null))))
                .isInstanceOf(ReferenceNotFoundException.class)
                .hasMessageContaining("Degree");
    }

    @Test
    void skillsRejetteUneCompetenceDupliqueeOuInconnue() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate()));
        Skill java = Skill.builder().id(UUID.randomUUID()).name("Java").skillType(SkillType.TECH).build();
        when(skillRepository.findById(java.getId())).thenReturn(Optional.of(java));

        assertThatThrownBy(() -> candidateService.updateSkills(USER_ID, List.of(
                new SkillRequest(java.getId(), 4, 3),
                new SkillRequest(java.getId(), 3, null))))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("Duplicate skill");

        UUID unknown = UUID.randomUUID();
        assertThatThrownBy(() -> candidateService.updateSkills(USER_ID,
                List.of(new SkillRequest(unknown, 3, null))))
                .isInstanceOf(ReferenceNotFoundException.class)
                .hasMessageContaining("Skill");
    }

    @Test
    void skillsRemplaceLaListeAvecLeNiveau() {
        Candidate candidate = candidate();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));
        Skill java = Skill.builder().id(UUID.randomUUID()).name("Java").skillType(SkillType.TECH).build();
        when(skillRepository.findById(java.getId())).thenReturn(Optional.of(java));

        candidateService.updateSkills(USER_ID, List.of(new SkillRequest(java.getId(), 5, 4)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CandidateSkill>> captor = ArgumentCaptor.forClass(List.class);
        verify(candidateSkillRepository).saveAll(captor.capture());
        CandidateSkill saved = captor.getValue().get(0);
        assertThat(saved.getSkill()).isSameAs(java);
        assertThat(saved.getLevel()).isEqualTo(5);
        assertThat(saved.getYearsExperience()).isEqualTo(4);
    }

    @Test
    void languagesRejetteUnDoublon() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate()));
        UUID english = UUID.randomUUID();
        when(languageRepository.findById(english)).thenReturn(Optional.of(
                Language.builder().id(english).symbol("en").name("English").build()));

        assertThatThrownBy(() -> candidateService.updateLanguages(USER_ID, List.of(
                new LanguageRequest(english, "C1"),
                new LanguageRequest(english, "B2"))))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("Duplicate language");
    }

    @Test
    void linksRejetteUnIssuerSurUnLienQuiNestPasUneCertification() {
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate()));

        assertThatThrownBy(() -> candidateService.updateLinks(USER_ID, List.of(
                new LinkRequest("Mon GitHub", "https://github.com/ada", "github", "OpenClassrooms", null))))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("certification");
        verify(candidateLinkRepository, never()).deleteAllByCandidateId(any());
    }

    @Test
    void linksAccepteUneCertificationEtRefuseUnTypeInconnu() {
        Candidate candidate = candidate();
        when(candidateRepository.findById(USER_ID)).thenReturn(Optional.of(candidate));

        candidateService.updateLinks(USER_ID, List.of(
                new LinkRequest("AWS SAA", "https://aws.example.com/123", "certification",
                        "Amazon Web Services", LocalDate.of(2024, 5, 1))));

        ArgumentCaptor<List<CandidateLink>> captor = ArgumentCaptor.forClass(List.class);
        verify(candidateLinkRepository).saveAll(captor.capture());
        CandidateLink saved = captor.getValue().get(0);
        assertThat(saved.getLinkType()).isEqualTo(LinkType.CERTIFICATION);
        assertThat(saved.getIssuer()).isEqualTo("Amazon Web Services");

        assertThatThrownBy(() -> candidateService.updateLinks(USER_ID, List.of(
                new LinkRequest("X", "https://x.com/ada", "reseau-social", null, null))))
                .isInstanceOf(InvalidProfileSectionException.class)
                .hasMessageContaining("link type");
    }

    @Test
    void lectureDesListesDeReferenceRetourneLesOptionsMappees() {
        Skill java = Skill.builder().id(UUID.randomUUID()).name("Java").skillType(SkillType.TECH).build();
        when(skillRepository.findAllByOrderBySkillTypeAscNameAsc()).thenReturn(List.of(java));
        when(candidateMapper.toSkillOption(java)).thenReturn(new SkillOption(java.getId(), "Java", "tech"));

        assertThat(candidateService.getSkillOptions())
                .extracting(SkillOption::skillType)
                .containsExactly("tech");
        verify(languageRepository, never()).findAllByOrderByNameAsc();
    }

    private Candidate candidate() {
        return Candidate.builder().id(USER_ID).title("Dev").build();
    }

    private static ExperienceRequest experience(String title, String start, String end) {
        return new ExperienceRequest(title, null, LocalDate.parse(start),
                end == null ? null : LocalDate.parse(end), "Acme", "fr");
    }
}
