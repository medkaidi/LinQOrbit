package com.linqorbit.candidate.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.linqorbit.candidate.dto.CandidateProfileResponse;
import com.linqorbit.candidate.dto.NormalizeRequest;
import com.linqorbit.candidate.dto.ParseContext;
import com.linqorbit.candidate.dto.ProfileLocation;
import com.linqorbit.candidate.exception.AiServiceException;

import tools.jackson.databind.json.JsonMapper;

/**
 * Teste l'appel POST /profile/normalize : corps JSON envoyé, objet canonique
 * renvoyé tel quel, traduction des statuts d'erreur — sans réseau réel.
 */
class ProfileNormalizeClientTest {

    private static final String NORMALIZE_URL = "http://ai.test/profile/normalize";

    private MockRestServiceServer server;
    private ProfileNormalizeClient profileNormalizeClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();
        profileNormalizeClient = new ProfileNormalizeClient(builder.build(), JsonMapper.builder().build());
    }

    private static NormalizeRequest request() {
        CandidateProfileResponse profile = new CandidateProfileResponse(null,
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                42, true, false, false, false);
        ProfileLocation location = new ProfileLocation("Paris", "FR");
        ParseContext context = new ParseContext(List.of("French"), List.of("Bachelor's degree"),
                List.of("Computer Science"), Map.of("Programming Languages", List.of("Java")));
        return new NormalizeRequest(profile, location, context);
    }

    @Test
    void normalizeEnvoieLeSnapshotEtLeContexteEnJson() {
        server.expect(requestTo(NORMALIZE_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", containsString("application/json")))
                .andExpect(content().string(containsString("\"hasUnvalidatedChanges\"")))
                .andExpect(content().string(containsString("\"context\"")))
                .andExpect(content().string(containsString("Programming Languages")))
                .andRespond(withSuccess("""
                        {"title": "Full Stack Developer", "summary": null}
                        """, MediaType.APPLICATION_JSON));

        profileNormalizeClient.normalize(request());

        server.verify();
    }

    @Test
    void normalizeRenvoieLObjetCanoniqueTelQuel() {
        String canonical = """
                {"schemaVersion": "1", "title": "Full Stack Developer",
                 "experiences": [], "diplomas": [], "skills": [], "languages": [], "links": []}
                """;
        server.expect(requestTo(NORMALIZE_URL))
                .andRespond(withSuccess(canonical, MediaType.APPLICATION_JSON));

        String response = profileNormalizeClient.normalize(request());

        assertThat(response).isEqualTo(canonical);
        server.verify();
    }

    @Test
    void normalizeTraduitLe429DuQuotaIA() {
        server.expect(requestTo(NORMALIZE_URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\": \"quota reached\"}"));

        assertThatThrownBy(() -> profileNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> {
                    AiServiceException ai = (AiServiceException) ex;
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(ai.getMessage()).isEqualTo("quota reached");
                });
    }

    @Test
    void normalizeTraduitUneErreurServeurIAEn502() {
        server.expect(requestTo(NORMALIZE_URL)).andRespond(withServerError());

        assertThatThrownBy(() -> profileNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void normalizeTombeSurLeMessageDeFallbackSansDetailJson() {
        server.expect(requestTo(NORMALIZE_URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.TEXT_PLAIN)
                .body("boom"));

        assertThatThrownBy(() -> profileNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> {
                    AiServiceException ai = (AiServiceException) ex;
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ai.getMessage()).isEqualTo("The profile could not be normalized.");
                });
    }

    @Test
    void normalizeRejetteUneReponseVide() {
        server.expect(requestTo(NORMALIZE_URL))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> profileNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
