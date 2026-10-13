package com.linqorbit.joboffer.client;

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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.linqorbit.candidate.exception.AiServiceException;
import com.linqorbit.joboffer.dto.OfferCompanySnapshot;
import com.linqorbit.joboffer.dto.OfferNormalizeRequest;
import com.linqorbit.joboffer.dto.OfferSnapshot;

import tools.jackson.databind.json.JsonMapper;

/**
 * Teste l'appel POST /job-offer/normalize : corps JSON envoyé, objet
 * canonique renvoyé tel quel, traduction des statuts d'erreur — sans réseau
 * réel.
 */
class JobOfferNormalizeClientTest {

    private static final String NORMALIZE_URL = "http://ai.test/job-offer/normalize";

    private MockRestServiceServer server;
    private JobOfferNormalizeClient jobOfferNormalizeClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();
        jobOfferNormalizeClient = new JobOfferNormalizeClient(builder.build(), JsonMapper.builder().build());
    }

    private static OfferNormalizeRequest request() {
        OfferSnapshot offer = new OfferSnapshot("Backend Engineer", "Own the API.", "senior", 3,
                "Paris", "FR", "Permanent", "Full-time", "Hybrid", null, null, null, null,
                new OfferCompanySnapshot("Acme", "We build payments."),
                List.of(), List.of(), List.of(), List.of());
        return new OfferNormalizeRequest(offer, null);
    }

    @Test
    void normalizeEnvoieLeSnapshotEnJson() {
        server.expect(requestTo(NORMALIZE_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", containsString("application/json")))
                .andExpect(content().string(containsString("\"title\"")))
                .andExpect(content().string(containsString("Backend Engineer")))
                .andExpect(content().string(containsString("\"contractTypeLabel\"")))
                .andRespond(withSuccess("""
                        {"title": "Backend Engineer", "summary": null}
                        """, MediaType.APPLICATION_JSON));

        jobOfferNormalizeClient.normalize(request());

        server.verify();
    }

    @Test
    void normalizeRenvoieLObjetCanoniqueTelQuel() {
        String canonical = """
                {"schemaVersion": "1", "title": "Backend Engineer",
                 "requiredSkills": [], "preferredSkills": []}
                """;
        server.expect(requestTo(NORMALIZE_URL))
                .andRespond(withSuccess(canonical, MediaType.APPLICATION_JSON));

        String response = jobOfferNormalizeClient.normalize(request());

        assertThat(response).isEqualTo(canonical);
        server.verify();
    }

    @Test
    void normalizeTraduitLe429DuQuotaIA() {
        server.expect(requestTo(NORMALIZE_URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\": \"quota reached\"}"));

        assertThatThrownBy(() -> jobOfferNormalizeClient.normalize(request()))
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

        assertThatThrownBy(() -> jobOfferNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void normalizeTombeSurLeMessageDeFallbackSansDetailJson() {
        server.expect(requestTo(NORMALIZE_URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.TEXT_PLAIN)
                .body("boom"));

        assertThatThrownBy(() -> jobOfferNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> {
                    AiServiceException ai = (AiServiceException) ex;
                    assertThat(ai.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ai.getMessage()).isEqualTo("The offer could not be normalized.");
                });
    }

    @Test
    void normalizeRejetteUneReponseVide() {
        server.expect(requestTo(NORMALIZE_URL))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> jobOfferNormalizeClient.normalize(request()))
                .isInstanceOf(AiServiceException.class)
                .satisfies(ex -> assertThat(((AiServiceException) ex).getStatus())
                        .isEqualTo(HttpStatus.BAD_GATEWAY));
    }
}
