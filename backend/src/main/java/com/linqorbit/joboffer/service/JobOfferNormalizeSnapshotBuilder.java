package com.linqorbit.joboffer.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;

import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;
import com.linqorbit.company.entity.Company;
import com.linqorbit.company.repository.CompanyRepository;
import com.linqorbit.joboffer.dto.OfferCompanySnapshot;
import com.linqorbit.joboffer.dto.OfferLanguageCriterion;
import com.linqorbit.joboffer.dto.OfferSkillCriterion;
import com.linqorbit.joboffer.dto.OfferSnapshot;
import com.linqorbit.joboffer.entity.ContractType;
import com.linqorbit.joboffer.entity.EmploymentType;
import com.linqorbit.joboffer.entity.JobOffer;
import com.linqorbit.joboffer.entity.JobOfferLanguage;
import com.linqorbit.joboffer.entity.JobOfferSkill;
import com.linqorbit.joboffer.entity.WorkMode;
import com.linqorbit.joboffer.repository.ContractTypeRepository;
import com.linqorbit.joboffer.repository.EmploymentTypeRepository;
import com.linqorbit.joboffer.repository.JobOfferDegreeRepository;
import com.linqorbit.joboffer.repository.JobOfferLanguageRepository;
import com.linqorbit.joboffer.repository.JobOfferSkillRepository;
import com.linqorbit.joboffer.repository.JobOfferStudyFieldRepository;
import com.linqorbit.joboffer.repository.WorkModeRepository;

import lombok.RequiredArgsConstructor;

/**
 * Snapshot d'offre pour le service IA : vocabulaire en libellés résolus
 * (jamais d'UUID — le contenu canonique n'en porte aucun), description
 * HTML riche strippée en texte brut (le LLM ne voit que du texte).
 */
@Component
@RequiredArgsConstructor
public class JobOfferNormalizeSnapshotBuilder {

    private final JobOfferSkillRepository jobOfferSkillRepository;
    private final JobOfferLanguageRepository jobOfferLanguageRepository;
    private final JobOfferDegreeRepository jobOfferDegreeRepository;
    private final JobOfferStudyFieldRepository jobOfferStudyFieldRepository;
    private final CompanyRepository companyRepository;
    private final SkillRepository skillRepository;
    private final LanguageRepository languageRepository;
    private final DegreeRepository degreeRepository;
    private final StudyFieldRepository studyFieldRepository;
    private final ContractTypeRepository contractTypeRepository;
    private final EmploymentTypeRepository employmentTypeRepository;
    private final WorkModeRepository workModeRepository;

    public OfferSnapshot build(JobOffer offer) {
        UUID offerId = offer.getId();
        List<JobOfferSkill> offerSkills = jobOfferSkillRepository.findByJobOfferIdIn(List.of(offerId));
        List<JobOfferLanguage> offerLanguages = jobOfferLanguageRepository.findByJobOfferIdIn(List.of(offerId));
        Map<UUID, String> skillNames = skillRepository.findAllById(
                        offerSkills.stream().map(skill -> skill.getSkillId()).toList()).stream()
                .collect(Collectors.toMap(Skill::getId, Skill::getName));
        Map<UUID, String> languageNames = languageRepository.findAllById(
                        offerLanguages.stream().map(language -> language.getLanguageId()).toList()).stream()
                .collect(Collectors.toMap(Language::getId, Language::getName));
        return new OfferSnapshot(
                offer.getTitle(),
                plainText(offer.getDescription()),
                offer.getSeniority() == null ? null : offer.getSeniority().getApiValue(),
                offer.getRequiredExpYear(),
                offer.getCity(),
                offer.getCountry(),
                labelOf(offer.getContractTypeId(),
                        id -> contractTypeRepository.findById(id).map(ContractType::getLabel).orElse(null)),
                labelOf(offer.getEmploymentTypeId(),
                        id -> employmentTypeRepository.findById(id).map(EmploymentType::getLabel).orElse(null)),
                labelOf(offer.getWorkModeId(),
                        id -> workModeRepository.findById(id).map(WorkMode::getLabel).orElse(null)),
                offer.getSalaryMin(),
                offer.getSalaryMax(),
                offer.getSalaryCurrency(),
                offer.getSalaryPeriod() == null ? null : offer.getSalaryPeriod().getApiValue(),
                companyOf(offer.getCompanyId()),
                offerSkills.stream()
                        .map(skill -> new OfferSkillCriterion(
                                skillNames.get(skill.getSkillId()),
                                skill.getRequirementType().getApiValue(),
                                skill.getWeight(),
                                skill.getYearsExperience()))
                        .toList(),
                offerLanguages.stream()
                        .map(language -> new OfferLanguageCriterion(
                                languageNames.get(language.getLanguageId()),
                                language.getLevel(),
                                language.getIsRequired()))
                        .toList(),
                loadDegreeLabels(offerId),
                loadStudyFieldLabels(offerId));
    }

    private OfferCompanySnapshot companyOf(UUID companyId) {
        return companyRepository.findById(companyId)
                .map(company -> new OfferCompanySnapshot(company.getName(), company.getDescription()))
                .orElseGet(() -> new OfferCompanySnapshot(null, null));
    }

    private List<String> loadDegreeLabels(UUID offerId) {
        List<UUID> ids = jobOfferDegreeRepository.findByJobOfferIdIn(List.of(offerId)).stream()
                .map(degree -> degree.getDegreeId()).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> labels = degreeRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Degree::getId, Degree::getLabel));
        return ids.stream().map(labels::get).filter(label -> label != null).toList();
    }

    private List<String> loadStudyFieldLabels(UUID offerId) {
        List<UUID> ids = jobOfferStudyFieldRepository.findByJobOfferIdIn(List.of(offerId)).stream()
                .map(field -> field.getStudyFieldId()).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> labels = studyFieldRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(StudyField::getId, StudyField::getLabel));
        return ids.stream().map(labels::get).filter(label -> label != null).toList();
    }

    /** FK vocabulaire nullable : {@code findById(null)} lèverait côté JPA. */
    private static String labelOf(UUID id, Function<UUID, String> label) {
        return id == null ? null : label.apply(id);
    }

    /**
     * Description Tiptap (HTML sanitisé) → texte brut pour le LLM. Un HTML
     * vide ou sans texte donne null (jamais de chaîne blanche).
     */
    static String plainText(String html) {
        if (html == null) {
            return null;
        }
        String text = Jsoup.parseBodyFragment(html).body().text().strip();
        return text.isEmpty() ? null : text;
    }
}
