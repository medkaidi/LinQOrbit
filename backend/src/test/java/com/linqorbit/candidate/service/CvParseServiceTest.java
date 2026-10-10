package com.linqorbit.candidate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.client.CvParseClient;
import com.linqorbit.candidate.client.ReferenceContextBuilder;

class CvParseServiceTest {

    private final CvParseClient cvParseClient = mock(CvParseClient.class);
    private final ReferenceContextBuilder referenceContextBuilder = mock(ReferenceContextBuilder.class);
    private final CvParseService cvParseService = new CvParseService(cvParseClient, referenceContextBuilder);

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
    void parseCvPasseLeContexteDeReferenceAuServiceIA() {
        ParseContext context = new ParseContext(List.of("French"), List.of("Bachelor's degree"),
                List.of("Computer Science"), Map.of("Programming Languages", List.of("Java")));
        when(referenceContextBuilder.build()).thenReturn(context);
        when(cvParseClient.parse(any(), any())).thenReturn(new CvParseResponse(
                "Backend Engineer", "Summary", List.of(), List.of(), List.of(), List.of(), List.of()));

        cvParseService.parseCv(pdf());

        verify(cvParseClient).parse(any(), same(context));
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
