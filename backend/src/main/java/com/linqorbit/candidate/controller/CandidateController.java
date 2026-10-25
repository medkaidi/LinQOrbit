package com.linqorbit.candidate.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.multipart.MultipartFile;

import com.linqorbit.candidate.dto.AboutRequest;
import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.DegreeOption;
import com.linqorbit.candidate.dto.DiplomaRequest;
import com.linqorbit.candidate.dto.ExperienceRequest;
import com.linqorbit.candidate.dto.LanguageOption;
import com.linqorbit.candidate.dto.LanguageRequest;
import com.linqorbit.candidate.dto.LinkRequest;
import com.linqorbit.candidate.dto.ProjectRequest;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillRequest;
import com.linqorbit.candidate.dto.SkillSuggestionRequest;
import com.linqorbit.candidate.dto.StudyFieldOption;
import com.linqorbit.candidate.dto.TargetPositionRequest;
import com.linqorbit.candidate.dto.VisibilityConsentRequest;
import com.linqorbit.candidate.dto.VisibilityConsentResponse;
import com.linqorbit.common.security.CurrentUserId;

import lombok.RequiredArgsConstructor;
import com.linqorbit.candidate.service.CandidateService;
import com.linqorbit.candidate.service.CandidateVisibilityService;
import com.linqorbit.candidate.service.CvParseService;
import com.linqorbit.candidate.service.NormalizationService;

@RestController
@RequestMapping("/api/v1/candidates")
@RequiredArgsConstructor
public class CandidateController implements CandidateApi {

    private final CandidateService candidateService;
    private final CvParseService cvParseService;
    private final NormalizationService normalizationService;
    private final CandidateVisibilityService visibilityService;

    @Override
    public ResponseEntity<CandidateProfileResponse> getProfile(Authentication authentication) {
        return ResponseEntity.ok(candidateService.getProfile(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<VisibilityConsentResponse> getVisibility(Authentication authentication) {
        return ResponseEntity.ok(visibilityService.get(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<VisibilityConsentResponse> setVisibility(VisibilityConsentRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(visibilityService.set(CurrentUserId.from(authentication), request.consent()));
    }

    @Override
    public ResponseEntity<Void> updateAbout(AboutRequest request, Authentication authentication) {
        candidateService.updateAbout(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateTargetPosition(TargetPositionRequest request, Authentication authentication) {
        candidateService.updateTargetPosition(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateExperiences(List<ExperienceRequest> request, Authentication authentication) {
        candidateService.updateExperiences(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateProjects(List<ProjectRequest> request, Authentication authentication) {
        candidateService.updateProjects(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateDiplomas(List<DiplomaRequest> request, Authentication authentication) {
        candidateService.updateDiplomas(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateSkills(List<SkillRequest> request, Authentication authentication) {
        candidateService.updateSkills(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateLanguages(List<LanguageRequest> request, Authentication authentication) {
        candidateService.updateLanguages(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> updateLinks(List<LinkRequest> request, Authentication authentication) {
        candidateService.updateLinks(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<Void> validateProfile(Authentication authentication) {
        normalizationService.validateProfile(CurrentUserId.from(authentication));
        return ResponseEntity.noContent().build();
    }

    @Override
    public SseEmitter normalizationEvents(Authentication authentication) {
        return normalizationService.subscribe(CurrentUserId.from(authentication));
    }

    @Override
    public ResponseEntity<Void> suggestSkills(SkillSuggestionRequest request, Authentication authentication) {
        candidateService.suggestSkills(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<CvParseResponse> parseCv(MultipartFile file) {
        return ResponseEntity.ok(cvParseService.parseCv(file));
    }

    @Override
    public ResponseEntity<List<SkillOption>> getSkills() {
        return ResponseEntity.ok(candidateService.getSkillOptions());
    }

    @Override
    public ResponseEntity<List<LanguageOption>> getLanguages() {
        return ResponseEntity.ok(candidateService.getLanguageOptions());
    }

    @Override
    public ResponseEntity<List<DegreeOption>> getDegrees() {
        return ResponseEntity.ok(candidateService.getDegreeOptions());
    }

    @Override
    public ResponseEntity<List<StudyFieldOption>> getStudyFields() {
        return ResponseEntity.ok(candidateService.getStudyFieldOptions());
    }
}
