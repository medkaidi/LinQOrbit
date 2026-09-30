package com.linqorbit.common.exception;

import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.linqorbit.auth.AccountNotActiveException;
import com.linqorbit.auth.EmailAlreadyExistsException;
import com.linqorbit.auth.InvalidCredentialsException;

/**
 * Gestion centralisée minimale des erreurs REST (format ProblemDetail / RFC 7807).
 * S'étendra aux exceptions métier lors du développement des fonctionnalités.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Validation failed");
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " : " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        problem.setDetail(errors);
        LOGGER.warn("Request rejected : validation errors [{}]", errors);
        return problem;
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ProblemDetail handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Email already registered");
        problem.setDetail("An account already exists for this email.");
        LOGGER.warn("Signup rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        problem.setTitle("Invalid credentials");
        problem.setDetail("The email or password is incorrect.");
        LOGGER.warn("Login rejected : invalid credentials");
        return problem;
    }

    @ExceptionHandler(AccountNotActiveException.class)
    public ProblemDetail handleAccountNotActive(AccountNotActiveException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("Account not active");
        problem.setDetail("This account is not active.");
        LOGGER.warn("Login rejected : account not active");
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
            LOGGER.error("Request failed : {} {}", status.value(), ex.getMessage(), ex);
        } else {
            LOGGER.warn("Request rejected : {} {}", status.value(), ex.getMessage());
        }
        return problem;
    }
}
