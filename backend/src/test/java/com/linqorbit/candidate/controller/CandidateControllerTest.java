package com.linqorbit.candidate.controller;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.linqorbit.candidate.dto.AboutRequest;
import com.linqorbit.candidate.dto.AboutResponse;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.DegreeOption;
import com.linqorbit.candidate.dto.LanguageOption;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillSuggestionRequest;
import com.linqorbit.candidate.dto.StudyFieldOption;
import com.linqorbit.candidate.dto.TargetPositionRequest;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.exception.EmptyProfileException;
import com.linqorbit.candidate.exception.InvalidProfileSectionException;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.config.SecurityConfig;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.candidate.service.CvParseService;
import com.linqorbit.candidate.service.NormalizationService;

@WebMvcTest(CandidateController.class)
@Import(SecurityConfig.class)
class CandidateControllerTest {

    private static final String PROFILE_PATH = "/api/v1/candidates/me/profile";
    private static final String ABOUT_JSON = """
            {
              "title": "Full-stack Developer",
              "bio": "Passionné de web",
              "yearsOfExperience": 5,
              "searchStatus": "open_to_work"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CandidateService candidateService;

    @MockitoBean
    private CvParseService cvParseService;

    @MockitoBean
    private NormalizationService normalizationService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void getProfileRenvoie200AvecLeTauxDeCompletion() throws Exception {
        UUID userId = UUID.randomUUID();
        when(candidateService.getProfile(userId)).thenReturn(new CandidateProfileResponse(
                new AboutResponse("Full-stack Developer", "Staff Engineer", "Passionné de web", 5, "open_to_work"),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), 14, false, false, false, false));

        mockMvc.perform(get(PROFILE_PATH)
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.about.title").value("Full-stack Developer"))
                .andExpect(jsonPath("$.about.targetPosition").value("Staff Engineer"))
                .andExpect(jsonPath("$.about.searchStatus").value("open_to_work"))
                .andExpect(jsonPath("$.completionPercentage").value(14))
                .andExpect(jsonPath("$.hasUnvalidatedChanges").value(false))
                .andExpect(jsonPath("$.normalizationFailed").value(false))
                .andExpect(jsonPath("$.normalizationInProgress").value(false));
    }

    @Test
    void getProfileRenvoie401SansJeton() throws Exception {
        mockMvc.perform(get(PROFILE_PATH))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updateAboutRenvoie204EtTransmetLeUtilisateurDuJeton() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ABOUT_JSON))
                .andExpect(status().isNoContent());

        verify(candidateService).updateAbout(eq(userId), any(AboutRequest.class));
    }

    @Test
    void updateAboutRenvoie400QuandLesChampsSontInvalides() throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/about")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\": \"sans titre\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.detail").value(containsString("title")));
    }

    @Test
    void updateTargetPositionRenvoie204EtTransmetLeUtilisateurDuJeton() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put(PROFILE_PATH + "/about/target-position")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPosition\": \"Staff Engineer\"}"))
                .andExpect(status().isNoContent());

        verify(candidateService).updateTargetPosition(eq(userId), any(TargetPositionRequest.class));
    }

    @Test
    void updateTargetPositionRenvoie400QuandLaValeurDepasse255Caracteres() throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/about/target-position")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetPosition\": \"" + "a".repeat(256) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.detail").value(containsString("targetPosition")));
    }

    @Test
    void updateProjectsRenvoie204EtTransmetLeUtilisateurDuJeton() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(put(PROFILE_PATH + "/projects")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"name": "Portfolio", "role": "Author", "description": "Site perso",
                                  "startDate": "2023-01-01", "endDate": null,
                                  "technologies": "Next.js, TypeScript"}]"""))
                .andExpect(status().isNoContent());

        verify(candidateService).updateProjects(eq(userId), any());
    }

    @Test
    void updateProjectsRenvoie400QuandLeNomEstVide() throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/projects")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"startDate\": \"2023-01-01\"}]"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSkillsRenvoie400QuandLaCompetenceNExistePas() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID skillId = UUID.randomUUID();
        doThrow(new ReferenceNotFoundException("Skill", skillId))
                .when(candidateService).updateSkills(eq(userId), any());

        mockMvc.perform(put(PROFILE_PATH + "/skills")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"skillId": "%s", "level": 4}]""".formatted(skillId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unknown reference"))
                .andExpect(jsonPath("$.detail").value(containsString("Skill")));
    }

    @Test
    void updateLinksRenvoie400QuandLaRegleMetierEstViolée() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new InvalidProfileSectionException(
                        "issuer and issuedAt are only allowed for a certification link"))
                .when(candidateService).updateLinks(eq(userId), any());

        mockMvc.perform(put(PROFILE_PATH + "/links")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"label": "GitHub", "url": "https://github.com/ada", "linkType": "github",
                                  "issuer": "OpenClassrooms"}]"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid profile section"))
                .andExpect(jsonPath("$.detail").value(containsString("certification")));
    }

    @Test
    void updateSkillsRenvoie400QuandLeNiveauEstHorsBornes() throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/skills")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"skillId": "11111111-1111-4111-8111-111111111111", "level": 9}]"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(containsString("level")));
    }

    @Test
    void skillsSansJetonRenvoie401() throws Exception {
        mockMvc.perform(put(PROFILE_PATH + "/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validateProfileRenvoie204EtDelegueAuService() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isNoContent());

        verify(normalizationService).validateProfile(userId);
    }

    @Test
    void validateProfileRenvoie401SansJeton() throws Exception {
        mockMvc.perform(post(PROFILE_PATH + "/validate"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void fluxDeNormalisationOuvreUnSseDuCandidatCourant() throws Exception {
        UUID userId = UUID.randomUUID();
        when(normalizationService.subscribe(userId))
                .thenReturn(new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());

        mockMvc.perform(get(PROFILE_PATH + "/normalization/events")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted());

        verify(normalizationService).subscribe(userId);
    }

    @Test
    void fluxDeNormalisationRenvoie401SansJeton() throws Exception {
        mockMvc.perform(get(PROFILE_PATH + "/normalization/events").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(normalizationService);
    }

    @Test
    void validateProfileRenvoie409QuandLeProfilEstVide() throws Exception {
        UUID userId = UUID.randomUUID();
        doThrow(new EmptyProfileException()).when(normalizationService).validateProfile(userId);

        mockMvc.perform(post(PROFILE_PATH + "/validate")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Empty profile"))
                .andExpect(jsonPath("$.detail").value(containsString("no content yet")));
    }

    @Test
    void listeDesCompetencesRenvoie200() throws Exception {
        UUID skillId = UUID.randomUUID();
        when(candidateService.getSkillOptions()).thenReturn(List.of(new SkillOption(skillId, "Java", "tech", "Programming Languages")));

        mockMvc.perform(get("/api/v1/candidates/reference/skills")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Java"))
                .andExpect(jsonPath("$[0].skillType").value("tech"))
                .andExpect(jsonPath("$[0].category").value("Programming Languages"));
    }

    @Test
    void listeDesLanguesEtDesDiplomesRenvoient200() throws Exception {
        when(candidateService.getLanguageOptions())
                .thenReturn(List.of(new LanguageOption(UUID.randomUUID(), "fr", "French")));
        when(candidateService.getDegreeOptions())
                .thenReturn(List.of(new DegreeOption(UUID.randomUUID(), "Master")));
        when(candidateService.getStudyFieldOptions()).thenReturn(
                List.of(new StudyFieldOption(UUID.randomUUID(), "Computer Science")));

        mockMvc.perform(get("/api/v1/candidates/reference/languages")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].symbol").value("fr"));
        mockMvc.perform(get("/api/v1/candidates/reference/degrees")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].label").value("Master"));
        mockMvc.perform(get("/api/v1/candidates/reference/study-fields")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].label").value("Computer Science"));
    }

    @Test
    void suggestionsDeCompetencesRenvoie204EtTransmetLeUtilisateurDuJeton() throws Exception {
        UUID userId = UUID.randomUUID();

        mockMvc.perform(post(PROFILE_PATH + "/skill-suggestions")
                        .with(SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(userId.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"names":["Kustom","CSS Grid"]}
                                """))
                .andExpect(status().isNoContent());

        verify(candidateService).suggestSkills(eq(userId), any(SkillSuggestionRequest.class));
    }

    @Test
    void suggestionsDeCompetencesRenvoie400QuandUnNomEstVide() throws Exception {
        mockMvc.perform(post(PROFILE_PATH + "/skill-suggestions")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"names":["Kustom","   "]}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void suggestionsSansJetonRenvoie401() throws Exception {
        mockMvc.perform(post(PROFILE_PATH + "/skill-suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"names":["Kustom"]}
                                """))
                .andExpect(status().isUnauthorized());
    }

    private static MockMultipartFile cvFile() {
        return new MockMultipartFile("file", "cv.pdf", MediaType.APPLICATION_PDF_VALUE,
                "%PDF-1.4 fake".getBytes());
    }

    @Test
    void parseCvRenvoie200AvecLExtractionStructuree() throws Exception {
        when(cvParseService.parseCv(any())).thenReturn(new CvParseResponse(
                "Backend Engineer", "Focus API",
                List.of(new CvParseResponse.Experience(
                        "Backend Engineer", "Acme", "France", "2021-03", null, "API payments")),
                List.of(),
                List.of(new CvParseResponse.Skill("Java", 8, 3)),
                List.of(),
                List.of()));

        mockMvc.perform(multipart(PROFILE_PATH + "/cv")
                        .file(cvFile())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.experiences[0].positionTitle").value("Backend Engineer"))
                .andExpect(jsonPath("$.skills[0].name").value("Java"));
    }

    @Test
    void parseCvRenvoie415QuandLeFichierNEstPasUnPdf() throws Exception {
        when(cvParseService.parseCv(any()))
                .thenThrow(new AiServiceException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported."));

        mockMvc.perform(multipart(PROFILE_PATH + "/cv")
                        .file(cvFile())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.title").value("CV parsing failed"))
                .andExpect(jsonPath("$.detail").value(containsString("PDF")));
    }

    @Test
    void parseCvRenvoie502QuandLeServiceIAEchoue() throws Exception {
        when(cvParseService.parseCv(any()))
                .thenThrow(new AiServiceException(HttpStatus.BAD_GATEWAY, "The AI service returned an empty response."));

        mockMvc.perform(multipart(PROFILE_PATH + "/cv")
                        .file(cvFile())
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .jwt(j -> j.subject(UUID.randomUUID().toString()))))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.title").value("CV parsing failed"));
    }

    @Test
    void parseCvRenvoie401SansJeton() throws Exception {
        mockMvc.perform(multipart(PROFILE_PATH + "/cv").file(cvFile()))
                .andExpect(status().isUnauthorized());
    }
}
