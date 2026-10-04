package com.linqorbit.common.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import com.linqorbit.candidate.exception.AiServiceException;

/**
 * Test de vérification de l'environnement de test (JUnit + AssertJ + Mockito)
 * portant sur le comportement réel du GlobalExceptionHandler.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleValidationRetourne400AvecLesErreursDeChamps() {
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        BindingResult bindingResult = mock(BindingResult.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(
                List.of(new FieldError("dto", "email", "", false, null, null, "doit être un email")));

        ProblemDetail problem = handler.handleValidation(ex);

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(problem.getDetail()).contains("email : doit être un email");
    }

    @Test
    void handleUnexpectedConserveLeStatutDesExceptionsTypeesSpring() {
        ProblemDetail problem = handler.handleUnexpected(new ErrorResponseException(HttpStatus.NOT_FOUND));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
    }

    @Test
    void handleUnexpectedProduitUn500PourLesAutresExceptions() {
        ProblemDetail problem = handler.handleUnexpected(new IllegalStateException("boom"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
        assertThat(problem.getDetail()).isEqualTo("boom");
    }

    @Test
    void handleAiServiceConserveLeStatutDeLaCoucheIA() {
        ProblemDetail problem = handler
                .handleAiService(new AiServiceException(HttpStatus.TOO_MANY_REQUESTS, "quota atteint"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(problem.getTitle()).isEqualTo("CV parsing failed");
        assertThat(problem.getDetail()).isEqualTo("quota atteint");
    }

    @Test
    void handleMaxUploadSizeRenvoie413() {
        ProblemDetail problem = handler.handleMaxUploadSize(new MaxUploadSizeExceededException(5L * 1024 * 1024));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE.value());
        assertThat(problem.getTitle()).isEqualTo("File too large");
    }
}
