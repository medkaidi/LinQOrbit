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
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.exception.AiServiceException;

class CvParseServiceTest {

    private final CvParseClient cvParseClient = mock(CvParseClient.class);
    private final CvParseService cvParseService = new CvParseService(cvParseClient);

    private static MockMultipartFile pdf() {
        return new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void parseCvDeloqueLeServiceIAAvecUnPdf() {
        CvParseResponse response = new CvParseResponse("Backend Engineer", "Summary",
                List.of(), List.of(), List.of(), List.of(), List.of());
        when(cvParseClient.parse(any())).thenReturn(response);

        assertThat(cvParseService.parseCv(pdf())).isSameAs(response);
        verify(cvParseClient).parse(any());
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
