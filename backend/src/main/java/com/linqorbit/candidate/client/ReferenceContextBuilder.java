package com.linqorbit.candidate.client;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;

import lombok.RequiredArgsConstructor;

/**
 * Référentiel DB groupé par famille, trié par libellé — source du prompt,
 * partagé par l'import de CV, la normalisation de profil et la
 * normalisation d'offre ({@code buildForOffer} : langues + skills).
 */
@Component
@RequiredArgsConstructor
public class ReferenceContextBuilder {

    private final LanguageRepository languageRepository;
    private final DegreeRepository degreeRepository;
    private final StudyFieldRepository studyFieldRepository;
    private final SkillRepository skillRepository;

    public ParseContext build() {
        List<String> languages = languageRepository.findAllByOrderByNameAsc().stream()
                .map(Language::getName)
                .toList();
        List<String> degrees = degreeRepository.findAllByOrderByLabelAsc().stream()
                .map(Degree::getLabel)
                .toList();
        List<String> studyFields = studyFieldRepository.findAllByOrderByLabelAsc().stream()
                .map(StudyField::getLabel)
                .toList();
        Map<String, List<String>> skills = skillRepository.findAllByOrderBySkillTypeAscNameAsc().stream()
                .collect(Collectors.groupingBy(Skill::getCategory, TreeMap::new,
                        Collectors.mapping(Skill::getName, Collectors.toList())));
        return new ParseContext(languages, degrees, studyFields, skills);
    }

    /**
     * Référentiel de l'offre : langues + skills seulement. L'offre n'a pas de
     * champ diplômes/études dans la fiche v1 (D22) — inonder le prompt de
     * ces deux listes n'ajouterait que des tokens morts et de l'ambiguïté.
     */
    public ParseContext buildForOffer() {
        List<String> languages = languageRepository.findAllByOrderByNameAsc().stream()
                .map(Language::getName)
                .toList();
        Map<String, List<String>> skills = skillRepository.findAllByOrderBySkillTypeAscNameAsc().stream()
                .collect(Collectors.groupingBy(Skill::getCategory, TreeMap::new,
                        Collectors.mapping(Skill::getName, Collectors.toList())));
        return new ParseContext(languages, List.of(), List.of(), skills);
    }
}
