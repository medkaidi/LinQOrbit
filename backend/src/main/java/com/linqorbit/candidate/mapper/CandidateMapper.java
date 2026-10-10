package com.linqorbit.candidate.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import com.linqorbit.candidate.entity.Candidate;
import com.linqorbit.candidate.entity.LinkType;
import com.linqorbit.candidate.entity.SearchStatus;
import com.linqorbit.candidate.entity.SkillType;
import com.linqorbit.candidate.dto.AboutResponse;
import com.linqorbit.candidate.dto.DegreeOption;
import com.linqorbit.candidate.dto.DiplomaResponse;
import com.linqorbit.candidate.dto.ExperienceResponse;
import com.linqorbit.candidate.dto.LanguageOption;
import com.linqorbit.candidate.dto.LanguageResponse;
import com.linqorbit.candidate.dto.LinkResponse;
import com.linqorbit.candidate.dto.SkillOption;
import com.linqorbit.candidate.dto.SkillResponse;
import com.linqorbit.candidate.dto.StudyFieldOption;
import com.linqorbit.candidate.entity.CandidateLanguage;
import com.linqorbit.candidate.entity.CandidateLink;
import com.linqorbit.candidate.entity.CandidateSkill;
import com.linqorbit.candidate.entity.Diploma;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.ProfessionalExperience;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;

/**
 * Mapping Entity → Response DTO. Les enums sortent par leur valeur API
 * (voir {@link SearchStatus#getApiValue()}), jamais par leur nom de constante.
 */
@Mapper(componentModel = "spring")
public interface CandidateMapper {

    @Mapping(target = "searchStatus", source = "searchStatus", qualifiedByName = "searchStatusToApi")
    AboutResponse toAboutResponse(Candidate candidate);

    ExperienceResponse toExperienceResponse(ProfessionalExperience experience);

    @Mapping(target = "degreeId", source = "degree.id")
    @Mapping(target = "degreeLabel", source = "degree.label")
    @Mapping(target = "studyFieldId", source = "studyField.id")
    @Mapping(target = "studyFieldLabel", source = "studyField.label")
    DiplomaResponse toDiplomaResponse(Diploma diploma);

    @Mapping(target = "skillId", source = "skill.id")
    @Mapping(target = "name", source = "skill.name")
    @Mapping(target = "skillType", source = "skill.skillType", qualifiedByName = "skillTypeToApi")
    SkillResponse toSkillResponse(CandidateSkill candidateSkill);

    @Mapping(target = "languageId", source = "language.id")
    @Mapping(target = "symbol", source = "language.symbol")
    @Mapping(target = "name", source = "language.name")
    LanguageResponse toLanguageResponse(CandidateLanguage candidateLanguage);

    @Mapping(target = "linkType", source = "linkType", qualifiedByName = "linkTypeToApi")
    LinkResponse toLinkResponse(CandidateLink candidateLink);

    @Mapping(target = "skillType", source = "skillType", qualifiedByName = "skillTypeToApi")
    SkillOption toSkillOption(Skill skill);

    LanguageOption toLanguageOption(Language language);

    DegreeOption toDegreeOption(Degree degree);

    StudyFieldOption toStudyFieldOption(StudyField studyField);

    @Named("searchStatusToApi")
    default String searchStatusToApi(SearchStatus status) {
        return status == null ? null : status.getApiValue();
    }

    @Named("skillTypeToApi")
    default String skillTypeToApi(SkillType type) {
        return type == null ? null : type.getApiValue();
    }

    @Named("linkTypeToApi")
    default String linkTypeToApi(LinkType type) {
        return type == null ? null : type.getApiValue();
    }
}
