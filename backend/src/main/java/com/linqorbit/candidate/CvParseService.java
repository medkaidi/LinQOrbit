package com.linqorbit.candidate;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Import de CV : contrôle du fichier, construction du contexte de référence
 * (vérité DB) puis délèguage au service IA.
 * Aucune écriture en base — le résultat est prévisualisé par le client.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CvParseService {

    private static final String PDF_CONTENT_TYPE = "application/pdf";

    private final CvParseClient cvParseClient;
    private final LanguageRepository languageRepository;
    private final DegreeRepository degreeRepository;
    private final StudyFieldRepository studyFieldRepository;
    private final SkillRepository skillRepository;

    public CvParseResponse parseCv(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AiServiceException(HttpStatus.BAD_REQUEST, "No file uploaded.");
        }
        if (!PDF_CONTENT_TYPE.equalsIgnoreCase(file.getContentType())) {
            throw new AiServiceException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only PDF files are supported.");
        }
        ParseContext context = buildContext();
        log.info("Parsing CV [{}] through the AI service", file.getOriginalFilename());
        CvParseResponse response = cvParseClient.parse(file, context);
        log.info("CV parsed: {} experience(s), {} diploma(s), {} skill(s)",
                response.experiences().size(), response.diplomas().size(), response.skills().size());
        return response;
    }

    /** Référentiel DB groupé par famille, trié par libellé — source du prompt. */
    private ParseContext buildContext() {
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
}
