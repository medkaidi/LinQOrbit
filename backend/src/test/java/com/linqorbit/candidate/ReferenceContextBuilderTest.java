package com.linqorbit.candidate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.entity.Degree;
import com.linqorbit.candidate.entity.Language;
import com.linqorbit.candidate.entity.Skill;
import com.linqorbit.candidate.entity.StudyField;
import com.linqorbit.candidate.repository.DegreeRepository;
import com.linqorbit.candidate.repository.LanguageRepository;
import com.linqorbit.candidate.repository.SkillRepository;
import com.linqorbit.candidate.repository.StudyFieldRepository;

class ReferenceContextBuilderTest {

    private final LanguageRepository languageRepository = mock(LanguageRepository.class);
    private final DegreeRepository degreeRepository = mock(DegreeRepository.class);
    private final StudyFieldRepository studyFieldRepository = mock(StudyFieldRepository.class);
    private final SkillRepository skillRepository = mock(SkillRepository.class);
    private final ReferenceContextBuilder referenceContextBuilder = new ReferenceContextBuilder(
            languageRepository, degreeRepository, studyFieldRepository, skillRepository);

    @Test
    void buildGroupeLeReferentielParFamilleTriParLibelle() {
        when(languageRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(Language.builder().name("Arabic").build(), Language.builder().name("French").build()));
        when(degreeRepository.findAllByOrderByLabelAsc())
                .thenReturn(List.of(Degree.builder().label("Bachelor's degree").build()));
        when(studyFieldRepository.findAllByOrderByLabelAsc())
                .thenReturn(List.of(StudyField.builder().label("Computer Science").build()));
        when(skillRepository.findAllByOrderBySkillTypeAscNameAsc()).thenReturn(List.of(
                Skill.builder().name("Microsoft Excel").category("Software").build(),
                Skill.builder().name("Java").category("Programming Languages").build()));

        ParseContext context = referenceContextBuilder.build();

        assertThat(context.languages()).containsExactly("Arabic", "French");
        assertThat(context.degrees()).containsExactly("Bachelor's degree");
        assertThat(context.studyFields()).containsExactly("Computer Science");
        assertThat(context.skills())
                .containsEntry("Programming Languages", List.of("Java"))
                .containsEntry("Software", List.of("Microsoft Excel"));
    }
}
