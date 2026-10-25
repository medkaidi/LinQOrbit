package com.linqorbit.embedding.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.linqorbit.candidate.entity.NormalizationSourceType;
import com.linqorbit.embedding.exception.EmbeddingNotRenderableException;

import tools.jackson.databind.json.JsonMapper;

/**
 * Rendu texte déterministe (stratégie text-1) : fidèle au JSON, sans rien
 * inventer, sans identité (employeurs, établissements, URL), tolérant aux
 * fiches partielles ou anciennes.
 */
class ProfileTextRendererTest {

    private final ProfileTextRenderer renderer = new ProfileTextRenderer(JsonMapper.builder().build());

    private static final String CANDIDATE = """
            {"schemaVersion":"3","title":"Senior Backend Engineer","summary":"Builds APIs.",
             "yearsOfExperience":8,"seniority":"senior","targetRole":"Tech Lead",
             "searchStatus":"open_to_work",
             "location":{"city":"Paris","country":"France"},
             "skills":[{"name":"Java","category":"Programming Languages","level":5,"yearsExperience":8},
                       {"name":"Kubernetes","category":"DevOps"}],
             "experiences":[{"positionTitle":"Backend Developer","companyName":"Acme Corp","domain":"Fintech",
                             "startDate":"2020-01","responsibilities":["Designed APIs","Led migrations"],
                             "technologies":["Java","Spring"],"achievements":["Cut latency by 40%"]}],
             "projects":[{"name":"Billing engine","role":"Lead","technologies":["Kotlin"]}],
             "diplomas":[{"title":"MSc Computer Science","institution":"MIT","degreeLabel":"Master's degree",
                          "studyFieldLabel":"Computer Science"}],
             "languages":[{"name":"French","level":"C2"},{"name":"English","level":"C1"}],
             "certifications":[{"name":"CKAD","issuer":"CNCF","url":"https://example.org/ckad"}],
             "links":[{"label":"LinkedIn","url":"https://www.linkedin.com/in/someone"}]}""";

    private static final String OFFER = """
            {"schemaVersion":"2","title":"Staff Engineer","alternateTitles":["Principal Engineer"],
             "domain":"Payments","seniority":"senior","contractType":"permanent","workMode":"hybrid",
             "location":{"city":"Lyon","country":"France"},"requiredYears":6,
             "summary":"Own the payments platform.",
             "salary":{"min":90000,"max":110000},"benefits":["Gym"],"companyPitch":"We are great",
             "requiredSkills":[{"name":"Java","category":"Programming Languages","weight":5,"level":4,"minYears":5}],
             "preferredSkills":[{"name":"Kafka","category":"Data"}],
             "responsibilities":[{"text":"Design the ledger","technologies":["PostgreSQL"]}],
             "requiredDegrees":[{"label":"Master's degree","source":"declared"}],
             "requiredStudyFields":[{"label":"Computer Science","source":"declared"}],
             "languages":[{"name":"English","level":"C1","required":true},
                          {"name":"German","level":"B1","required":false}],
             "certifications":[{"name":"AWS SA","issuer":"Amazon"}]}""";

    @Test
    void rendersACandidateWithEveryCapabilitySection() {
        String text = renderer.render(CANDIDATE, NormalizationSourceType.CANDIDATE);

        assertThat(text).startsWith("Candidate profile\n").contains(
                "Title: Senior Backend Engineer",
                "Seniority: senior",
                "Years of experience: 8",
                "Target role: Tech Lead",
                "Location: Paris, France",
                "Summary: Builds APIs.",
                "- Java (Programming Languages, level 5, years 8)",
                "- Kubernetes (DevOps)",
                "- Backend Developer (Fintech); Responsibilities: Designed APIs, Led migrations; "
                        + "Technologies: Java, Spring; Achievements: Cut latency by 40%",
                "- Billing engine (Lead); Technologies: Kotlin",
                "- MSc Computer Science (Master's degree, Computer Science)",
                "- French (C2)",
                "- CKAD");
    }

    @Test
    void aCandidateTextCarriesNoIdentity() {
        String text = renderer.render(CANDIDATE, NormalizationSourceType.CANDIDATE);

        // Employeur, établissement, émetteur, URL, statut de recherche : écartés.
        assertThat(text).doesNotContain("Acme", "MIT", "CNCF", "http", "linkedin", "open_to_work", "2020");
    }

    @Test
    void rendersAnOfferWithTheSameVocabularyAsACandidate() {
        String text = renderer.render(OFFER, NormalizationSourceType.OFFER);

        assertThat(text).startsWith("Job offer\n").contains(
                "Title: Staff Engineer",
                "Also known as: Principal Engineer",
                "Domain: Payments",
                "Seniority: senior",
                "Contract type: permanent",
                "Work mode: hybrid",
                "Location: Lyon, France",
                "Required years of experience: 6",
                "Summary: Own the payments platform.",
                "Required skills:",
                "- Java (Programming Languages, level 4, min years 5)",
                "Preferred skills:",
                "- Kafka (Data)",
                "- Design the ledger; Technologies: PostgreSQL",
                "- Master's degree",
                "Study fields:",
                "- English (C1)",
                "- German (B1, preferred)",
                "- AWS SA");
    }

    @Test
    void anOfferTextCarriesNeitherSalaryBenefitsNorPitchNorIssuer() {
        String text = renderer.render(OFFER, NormalizationSourceType.OFFER);

        assertThat(text).doesNotContain("90000", "Gym", "We are great", "Amazon");
    }

    @Test
    void theRenderingIsDeterministic() {
        assertThat(renderer.render(CANDIDATE, NormalizationSourceType.CANDIDATE))
                .isEqualTo(renderer.render(CANDIDATE, NormalizationSourceType.CANDIDATE));
        assertThat(renderer.render(OFFER, NormalizationSourceType.OFFER))
                .isEqualTo(renderer.render(OFFER, NormalizationSourceType.OFFER));
    }

    @Test
    void aPartialOrOlderSheetOnlyRendersWhatItHas() {
        String text = renderer.render("""
                {"schemaVersion":"2","title":"Developer","skills":[{"name":"Java"},{"category":"no name"}],
                 "experiences":[{"positionTitle":null,"companyName":"X"}],"languages":[],"certifications":[]}""",
                NormalizationSourceType.CANDIDATE);

        assertThat(text).isEqualTo("Candidate profile\nTitle: Developer\nSkills:\n- Java");
    }

    @Test
    void blankAndNullValuesAreIgnored() {
        String text = renderer.render("""
                {"title":"  Engineer  ","summary":"   ","seniority":null,"yearsOfExperience":null,
                 "location":{"city":" ","country":"France"}}""", NormalizationSourceType.CANDIDATE);

        assertThat(text).isEqualTo("Candidate profile\nTitle: Engineer\nLocation: France");
    }

    @Test
    void aVeryLongTextIsCappedKeepingTheStartAndNeverExceedingTheLimit() {
        String longBio = "x".repeat(40_000);
        String text = renderer.render("{\"title\":\"Engineer\",\"summary\":\"" + longBio + "\"}",
                NormalizationSourceType.CANDIDATE);

        assertThat(text.length()).isLessThanOrEqualTo(ProfileTextRenderer.MAX_CHARS);
        assertThat(text).startsWith("Candidate profile\nTitle: Engineer\nSummary: xxx");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"schemaVersion\":\"3\"}", "{\"skills\":[],\"experiences\":[{}]}",
            "[]", "\"text\"", "null", "", "   ", "{not json"})
    void aSheetWithNothingRenderableIsRejectedForGood(String content) {
        assertThatThrownBy(() -> renderer.render(content, NormalizationSourceType.CANDIDATE))
                .isInstanceOf(EmbeddingNotRenderableException.class);
    }

    @Test
    void aNullContentIsRejected() {
        assertThatThrownBy(() -> renderer.render(null, NormalizationSourceType.OFFER))
                .isInstanceOf(EmbeddingNotRenderableException.class);
    }
}
