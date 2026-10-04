package com.linqorbit.common.exception;

import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.util.BindErrorUtils;

import com.linqorbit.auth.exception.AccountNotActiveException;
import com.linqorbit.auth.exception.EmailAlreadyExistsException;
import com.linqorbit.auth.exception.InvalidCredentialsException;
import com.linqorbit.auth.exception.WrongCurrentPasswordException;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.exception.InvalidProfileSectionException;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;

/**
 * Gestion centralisée minimale des erreurs REST (format ProblemDetail / RFC 7807).
 * S'étendra aux exceptions métier lors du développement des fonctionnalités.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Validation failed");
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " : " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        problem.setDetail(errors);
        log.warn("Request rejected : validation errors [{}]", errors);
        return problem;
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ProblemDetail handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Email already registered");
        problem.setDetail("An account already exists for this email.");
        log.warn("Signup rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        problem.setTitle("Invalid credentials");
        problem.setDetail("The email or password is incorrect.");
        log.warn("Login rejected : invalid credentials");
        return problem;
    }

    @ExceptionHandler(AccountNotActiveException.class)
    public ProblemDetail handleAccountNotActive(AccountNotActiveException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("Account not active");
        problem.setDetail("This account is not active.");
        log.warn("Login rejected : account not active");
        return problem;
    }

    @ExceptionHandler(WrongCurrentPasswordException.class)
    public ProblemDetail handleWrongCurrentPassword(WrongCurrentPasswordException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("Wrong current password");
        problem.setDetail("The current password is incorrect.");
        log.warn("Password change rejected : wrong current password");
        return problem;
    }

    @ExceptionHandler(InvalidProfileSectionException.class)
    public ProblemDetail handleInvalidProfileSection(InvalidProfileSectionException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Invalid profile section");
        problem.setDetail(ex.getMessage());
        log.warn("Candidate profile update rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(ReferenceNotFoundException.class)
    public ProblemDetail handleReferenceNotFound(ReferenceNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Unknown reference");
        problem.setDetail(ex.getMessage());
        log.warn("Candidate profile update rejected : {}", ex.getMessage());
        return problem;
    }

    /**
     * Corps en liste (ex : PUT des expériences) : Spring valide chaque élément via
     * la validation de méthode, pas via MethodArgumentNotValidException.
     */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ProblemDetail handleMethodValidation(HandlerMethodValidationException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Validation failed");
        String errors = BindErrorUtils.resolveAndJoin(ex.getAllErrors());
        problem.setDetail(errors);
        log.warn("Request rejected : validation errors [{}]", errors);
        return problem;
    }

    /**
     * Échec de l'appel au service IA : le statut (415, 422, 429, 502, 504…) est
     * porté par l'exception elle-même pour refléter la couche qui a échoué.
     */
    @ExceptionHandler(AiServiceException.class)
    public ProblemDetail handleAiService(AiServiceException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(ex.getStatus());
        problem.setTitle("CV parsing failed");
        problem.setDetail(ex.getMessage());
        log.warn("CV parsing rejected : {} {}", ex.getStatus().value(), ex.getMessage());
        return problem;
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.PAYLOAD_TOO_LARGE);
        problem.setTitle("File too large");
        problem.setDetail("File too large: 5 MB maximum (CV upload).");
        log.warn("Upload rejected : {} bytes", ex.getMaxUploadSize());
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        // Les exceptions typées de Spring (404, 405, 400…) gardent leur statut d'origine.
        HttpStatus status = ex instanceof ErrorResponse errorResponse
                ? HttpStatus.resolve(errorResponse.getStatusCode().value())
                : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(status.is5xxServerError() ? "Internal server error" : status.getReasonPhrase());
        problem.setDetail(ex.getMessage());
        if (status.is5xxServerError()) {
            log.error("Request failed : {} {}", status.value(), ex.getMessage(), ex);
        } else {
            log.warn("Request rejected : {} {}", status.value(), ex.getMessage());
        }
        return problem;
    }
}
