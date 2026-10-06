package com.linqorbit.candidate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;

class CvParseServiceTest {

    private final CvParseClient cvParseClient = mock(CvParseClient.class);
    private final LanguageRepository languageRepository = mock(LanguageRepository.class);
    private final DegreeRepository degreeRepository = mock(DegreeRepository.class);
    private final StudyFieldRepository studyFieldRepository = mock(StudyFieldRepository.class);
    private final SkillRepository skillRepository = mock(SkillRepository.class);
    private final CvParseService cvParseService = new CvParseService(
            cvParseClient, languageRepository, degreeRepository, studyFieldRepository, skillRepository);

    private static MockMultipartFile pdf() {
        return new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void parseCvDeloqueLeServiceIAAvecUnPdf() {
        CvParseResponse response = new CvParseResponse("Backend Engineer", "Summary",
                List.of(), List.of(), List.of(), List.of(), List.of());
        when(cvParseClient.parse(any(), any())).thenReturn(response);

        assertThat(cvParseService.parseCv(pdf())).isSameAs(response);
        verify(cvParseClient).parse(any(), any());
    }

    @Test
    void parseCvEnvoieLeContexteDeReferenceGroupeParFamille() {
        when(cvParseClient.parse(any(), any())).thenReturn(new CvParseResponse(
                "Backend Engineer", "Summary", List.of(), List.of(), List.of(), List.of(), List.of()));
        when(languageRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(Language.builder().name("Arabic").build(), Language.builder().name("French").build()));
        when(degreeRepository.findAllByOrderByLabelAsc())
                .thenReturn(List.of(Degree.builder().label("Bachelor's degree").build()));
        when(studyFieldRepository.findAllByOrderByLabelAsc())
                .thenReturn(List.of(StudyField.builder().label("Computer Science").build()));
        when(skillRepository.findAllByOrderBySkillTypeAscNameAsc()).thenReturn(List.of(
                Skill.builder().name("Microsoft Excel").category("Software").build(),
                Skill.builder().name("Java").category("Programming Languages").build()));

        cvParseService.parseCv(pdf());

        ArgumentCaptor<ParseContext> captor = ArgumentCaptor.forClass(ParseContext.class);
        verify(cvParseClient).parse(any(), captor.capture());
        ParseContext context = captor.getValue();
        assertThat(context.languages()).containsExactly("Arabic", "French");
        assertThat(context.degrees()).containsExactly("Bachelor's degree");
        assertThat(context.studyFields()).containsExactly("Computer Science");
        assertThat(context.skills())
                .containsEntry("Programming Languages", List.of("Java"))
                .containsEntry("Software", List.of("Microsoft Excel"));
    }

    @Test
    void parseCvRejetteUnFichierAbsent() {
        assertThatThrownBy(() -> cvParseService.parseCv(null))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void parseCvRejetteUnFichierVide() {
        MockMultipartFile empty = new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[0]);

        assertThatThrownBy(() -> cvParseService.parseCv(empty))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void parseCvRejetteUnFichierNonPdf() {
        MockMultipartFile docx = new MockMultipartFile("file", "cv.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "data".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> cvParseService.parseCv(docx))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE));
    }
}
