package com.linqorbit.matching.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.matching.dto.MatchingAnalyzeRequest;
import com.linqorbit.matching.dto.MatchingCriterionPayload;
import com.linqorbit.matching.dto.MatchingEducationPayload;

import tools.jackson.databind.json.JsonMapper;

/**
 * Teste l'appel POST /matching/analyze : contexte complet envoyé en JSON (sans
 * poids), analyse renvoyée telle quelle, traduction des statuts d'erreur —
 * sans réseau réel. Miroir de {@code JobOfferNormalizeClientTest}.
 */
class MatchingAnalyzeClientTest {

    private static final String ANALYZE_URL = "http://ai.test/matching/analyze";

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private MockRestServiceServer server;
    private MatchingAnalyzeClient matchingAnalyzeClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();
        matchingAnalyzeClient = new MatchingAnalyzeClient(builder.build(), jsonMapper);
    }

    private MatchingAnalyzeRequest request() {
        return new MatchingAnalyzeRequest("6f1c9a2e-0000-4000-8000-000000000001",
                jsonMapper.readTree("{\"schemaVersion\": \"3\", \"skills\": []}"),
                jsonMapper.readTree("{\"schemaVersion\": \"2\", \"title\": \"Backend Engineer\"}"),
                List.of(new MatchingCriterionPayload("skill:java", "required_skills", "Java", "5 years")),
                List.of(), List.of());
    }

    @Test
    void analyzeEnvoieToutLeContexteEnJsonSansPoids() {
        server.expect(requestTo(ANALYZE_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", containsString("application/json")))
                .andExpect(content().string(containsString("\"matchingId\":\"6f1c9a2e-0000-4000-8000-000000000001\"")))
                .andExpect(content().string(containsString("\"candidate\":{\"schemaVersion\":\"3\"")))
                .andExpect(content().string(containsString("\"offer\":{\"schemaVersion\":\"2\"")))
                .andExpect(content().string(containsString("\"key\":\"skill:java\"")))
                .andExpect(content().string(not(containsString("weight"))))
                .andRespond(withSuccess("{\"assessments\": []}", MediaType.APPLICATION_JSON));

        matchingAnalyzeClient.analyze(request());

        server.verify();
    }

    @Test
    void laFormationVoyageAvecSonExigenceStructureeEtLaCertificationSansAucune() {
        MatchingAnalyzeRequest request = new MatchingAnalyzeRequest("6f1c9a2e-0000-4000-8000-000000000001",
                jsonMapper.readTree("{\"schemaVersion\": \"3\", \"diplomas\": []}"),
                jsonMapper.readTree("{\"schemaVersion\": \"2\", \"title\": \"Backend Engineer\"}"),
                List.of(new MatchingCriterionPayload("education:requirement", "education", "Education",
                                "Degree level (one of, or above): Master; Field of study (one of): Computer Science",
                                new MatchingEducationPayload(List.of("Master"), List.of(), List.of("Computer Science"))),
                        new MatchingCriterionPayload("certification:aws", "education", "Certification: AWS", null)),
                List.of(), List.of());
        server.expect(requestTo(ANALYZE_URL))
                .andExpect(jsonPath("$.criteria[0].key").value("education:requirement"))
                .andExpect(jsonPath("$.criteria[0].education.degreeLevels[0]").value("Master"))
                .andExpect(jsonPath("$.criteria[0].education.credentials").isEmpty())
                .andExpect(jsonPath("$.criteria[0].education.fields[0]").value("Computer Science"))
                .andExpect(jsonPath("$.criteria[1].key").value("certification:aws"))
                // Certification : aucune exigence de formation (null explicite, accepté par le service IA).
                .andExpect(jsonPath("$.criteria[1].education").value(nullValue()))
                .andRespond(withSuccess("{\"assessments\": []}", MediaType.APPLICATION_JSON));

        matchingAnalyzeClient.analyze(request);

        server.verify();
    }

    @Test
    void analyzeRenvoieLAnalyseTelleQuelle() {
        String analysis = """
                {"schemaVersion": "1", "policyVersion": "generic-1",
                 "assessments": [{"criterionKey": "skill:java", "score": 90, "rationale": "r", "evidence": []}]}
                """;
        server.expect(requestTo(ANALYZE_URL)).andRespond(withSuccess(analysis, MediaType.APPLICATION_JSON));

        assertThat(matchingAnalyzeClient.analyze(request())).isEqualTo(analysis);
        server.verify();
    }

    @Test
    void analyzeRelitLeDetailDUn4xxDuServiceIA() {
        server.expect(requestTo(ANALYZE_URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\": \"The offer has no criterion to assess.\"}"));

        assertThatThrownBy(() -> matchingAnalyzeClient.analyze(request()))
                .isInstanceOfSatisfying(AiServiceException.class, ai -> {
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ai.getMessage()).isEqualTo("The offer has no criterion to assess.");
                });
    }

    @Test
    void analyzeTombeSurLeMessageDeFallbackSansDetailJson() {
        server.expect(requestTo(ANALYZE_URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.TEXT_PLAIN)
                .body("boom"));

        assertThatThrownBy(() -> matchingAnalyzeClient.analyze(request()))
                .isInstanceOfSatisfying(AiServiceException.class, ai -> {
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ai.getMessage()).isEqualTo("The matching could not be analyzed.");
                });
    }

    @Test
    void analyzeTraduitUneErreurServeurIAEn502() {
        server.expect(requestTo(ANALYZE_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> matchingAnalyzeClient.analyze(request()))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ai -> assertThat(ai.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void analyzeTraduitUnServiceIAInjoignableEn504() {
        server.expect(requestTo(ANALYZE_URL)).andRespond(request -> {
            throw new IOException("connection refused");
        });

        assertThatThrownBy(() -> matchingAnalyzeClient.analyze(request()))
                .isInstanceOfSatisfying(AiServiceException.class, ai -> {
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);
                    assertThat(ai.getMessage()).isEqualTo("The AI service is unreachable.");
                });
    }

    @Test
    void analyzeRejetteUneReponseVide() {
        server.expect(requestTo(ANALYZE_URL)).andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> matchingAnalyzeClient.analyze(request()))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ai -> assertThat(ai.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
