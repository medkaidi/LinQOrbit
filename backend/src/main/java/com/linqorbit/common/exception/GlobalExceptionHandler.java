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

import com.linqorbit.admin.exception.InvalidSkillCategoryException;
import com.linqorbit.admin.exception.InvalidSkillTypeException;
import com.linqorbit.admin.exception.InvalidUserStatusException;
import com.linqorbit.admin.exception.SelfStatusChangeException;
import com.linqorbit.admin.exception.SuggestionNotFoundException;
import com.linqorbit.admin.exception.UserNotFoundException;
import com.linqorbit.auth.exception.AccountNotActiveException;
import com.linqorbit.auth.exception.EmailAlreadyExistsException;
import com.linqorbit.auth.exception.InvalidCredentialsException;
import com.linqorbit.auth.exception.WrongCurrentPasswordException;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.exception.EmptyProfileException;
import com.linqorbit.candidate.exception.InvalidProfileSectionException;
import com.linqorbit.candidate.exception.ReferenceNotFoundException;
import com.linqorbit.company.exception.CompanyAccessDeniedException;
import com.linqorbit.company.exception.CompanyNotFoundException;
import com.linqorbit.joboffer.exception.InvalidJobOfferException;
import com.linqorbit.joboffer.exception.InvalidJobOfferStatusException;
import com.linqorbit.joboffer.exception.JobOfferAccessDeniedException;
import com.linqorbit.joboffer.exception.JobOfferNotFoundException;
import com.linqorbit.joboffer.exception.JobOfferReferenceNotFoundException;
import com.linqorbit.recruiter.exception.RecruiterAlreadyExistsException;
import com.linqorbit.recruiter.exception.RecruiterNotFoundException;

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

    @ExceptionHandler(EmptyProfileException.class)
    public ProblemDetail handleEmptyProfile(EmptyProfileException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Empty profile");
        problem.setDetail("Your profile has no content yet. Add profile information before validating it.");
        log.warn("Candidate profile validation rejected : {}", ex.getMessage());
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

    @ExceptionHandler(RecruiterNotFoundException.class)
    public ProblemDetail handleRecruiterNotFound(RecruiterNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Recruiter profile not found");
        problem.setDetail("This account does not have a recruiter profile yet.");
        log.warn("Recruiter profile rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(RecruiterAlreadyExistsException.class)
    public ProblemDetail handleRecruiterAlreadyExists(RecruiterAlreadyExistsException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Recruiter profile already exists");
        problem.setDetail("This account already has a recruiter profile.");
        log.warn("Recruiter profile creation rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(CompanyNotFoundException.class)
    public ProblemDetail handleCompanyNotFound(CompanyNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Company not found");
        problem.setDetail("No company matches this identifier for your account.");
        log.warn("Company operation rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(CompanyAccessDeniedException.class)
    public ProblemDetail handleCompanyAccessDenied(CompanyAccessDeniedException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("Owner only");
        problem.setDetail("Only the company owner can perform this action.");
        log.warn("Company operation rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidUserStatusException.class)
    public ProblemDetail handleInvalidUserStatus(InvalidUserStatusException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Unsupported status");
        problem.setDetail("Only ACTIVE and INACTIVE can be set through this endpoint.");
        log.warn("Admin status update rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(SelfStatusChangeException.class)
    public ProblemDetail handleSelfStatusChange(SelfStatusChangeException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Cannot change own status");
        problem.setDetail("An administrator cannot activate or deactivate their own account.");
        log.warn("Admin status update rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail handleUserNotFound(UserNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("User not found");
        problem.setDetail("No account matches this identifier.");
        log.warn("Admin status update rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(SuggestionNotFoundException.class)
    public ProblemDetail handleSuggestionNotFound(SuggestionNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Skill suggestion not found");
        problem.setDetail("No suggestion matches this identifier.");
        log.warn("Admin suggestion review rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidSkillCategoryException.class)
    public ProblemDetail handleInvalidSkillCategory(InvalidSkillCategoryException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Unknown skill category");
        problem.setDetail("Pick one of the existing skill categories.");
        log.warn("Admin suggestion review rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidSkillTypeException.class)
    public ProblemDetail handleInvalidSkillType(InvalidSkillTypeException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Invalid skill type");
        problem.setDetail("Only 'tech' and 'soft' are supported.");
        log.warn("Admin suggestion review rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(JobOfferNotFoundException.class)
    public ProblemDetail handleJobOfferNotFound(JobOfferNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Job offer not found");
        problem.setDetail("No job offer matches this identifier for your account.");
        log.warn("Job offer operation rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(JobOfferAccessDeniedException.class)
    public ProblemDetail handleJobOfferAccessDenied(JobOfferAccessDeniedException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("Cannot manage this job offer");
        problem.setDetail("Only the company owner or the recruiter who created the offer can manage it.");
        log.warn("Job offer operation rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidJobOfferStatusException.class)
    public ProblemDetail handleInvalidJobOfferStatus(InvalidJobOfferStatusException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Invalid job offer status");
        problem.setDetail("This action is not allowed from the offer's current status.");
        log.warn("Job offer status transition rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(JobOfferReferenceNotFoundException.class)
    public ProblemDetail handleJobOfferReferenceNotFound(JobOfferReferenceNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Unknown reference");
        problem.setDetail(ex.getMessage());
        log.warn("Job offer update rejected : {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(InvalidJobOfferException.class)
    public ProblemDetail handleInvalidJobOffer(InvalidJobOfferException ex) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problem.setTitle("Invalid job offer");
        problem.setDetail(ex.getMessage());
        log.warn("Job offer operation rejected : {}", ex.getMessage());
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

    /**
     * Filet de sécurité pour tout ce qui n'a pas de handler dédié : exceptions
     * framework (route morte,405, JSON illisible…), erreurs de programme
     * (IllegalArgumentException…), bugs inattendus.
     *
     * <p>Règle : le message brut d'une exception n'est <strong>jamais</strong> renvoyé
     * au client — le détail est générique, le détail réel (classe + message + stack)
     * part dans les logs. Seules les exceptions métier (handler dédié ci-dessus) ont un
     * message affichable, construit par nos soins.
     */
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
        problem.setDetail(status.is5xxServerError()
                ? "An unexpected error occurred. It has been logged for our team."
                : "The request could not be processed.");
        if (status.is5xxServerError()) {
            log.error("Request failed : {} {} : {}", status.value(), ex.getClass().getSimpleName(), ex.getMessage(), ex);
        } else {
            log.warn("Request rejected : {} {} : {}", status.value(), ex.getClass().getSimpleName(), ex.getMessage());
        }
        return problem;
    }
}
