package com.linqorbit.candidate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.linqorbit.candidate.dto.CvParseResponse;
import com.linqorbit.candidate.exception.AiServiceException;

import tools.jackson.databind.json.JsonMapper;

/**
 * Teste la traduction du service IA (FastAPI) : mapping JSON en entrée,
 * traduction des statuts d'erreur en sortie, sans réseau réel.
 */
class CvParseClientTest {

    private static final String PARSE_URL = "http://ai.test/cv/parse";

    private MockRestServiceServer server;
    private CvParseClient cvParseClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();
        cvParseClient = new CvParseClient(builder.build(), new JsonMapper());
    }

    private static MockMultipartFile pdf() {
        return new MockMultipartFile("file", "cv.pdf", "application/pdf",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void parseMappeLaReponseJsonDuServiceIA() {
        server.expect(requestTo(PARSE_URL))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {
                          "title": "Backend Engineer",
                          "summary": "Focus API",
                          "experiences": [
                            {"positionTitle": "Backend Engineer", "companyName": "Acme",
                             "companyCountry": "France", "startDate": "2021-03",
                             "endDate": null, "description": "API payments"}
                          ],
                          "diplomas": [],
                          "skills": [{"name": "Java", "level": 8, "yearsExperience": 3}],
                          "languages": [],
                          "links": []
                        }
                        """, MediaType.APPLICATION_JSON));

        CvParseResponse response = cvParseClient.parse(pdf());

        assertThat(response.title()).isEqualTo("Backend Engineer");
        assertThat(response.experiences()).hasSize(1);
        assertThat(response.experiences().get(0).positionTitle()).isEqualTo("Backend Engineer");
        assertThat(response.experiences().get(0).startDate()).isEqualTo("2021-03");
        assertThat(response.experiences().get(0).endDate()).isNull();
        assertThat(response.skills()).containsExactly(new CvParseResponse.Skill("Java", 8, 3));
        server.verify();
    }

    @Test
    void parseTraduitLe429DuQuotaIA() {
        server.expect(requestTo(PARSE_URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\": \"quota reached\"}"));

        assertThatThrownBy(() -> cvParseClient.parse(pdf()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> {
                    AiServiceException ai = (AiServiceException) ex;
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(ai.getMessage()).isEqualTo("quota reached");
                });
    }

    @Test
    void parseTraduitLe422SansTexteExtractible() {
        server.expect(requestTo(PARSE_URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\": \"no text could be extracted from the PDF\"}"));

        assertThatThrownBy(() -> cvParseClient.parse(pdf()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> {
                    AiServiceException ai = (AiServiceException) ex;
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ai.getMessage()).isEqualTo("no text could be extracted from the PDF");
                });
    }

    @Test
    void parseTraduitUneErreurServeurIAEn502() {
        server.expect(requestTo(PARSE_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> cvParseClient.parse(pdf()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
