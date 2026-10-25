package com.linqorbit.embedding.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
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
import com.linqorbit.embedding.dto.EmbedResponse;

import tools.jackson.databind.json.JsonMapper;

/** Appel POST /embed : corps envoyé, vecteurs renvoyés, traduction des erreurs — sans réseau réel. */
class EmbedClientTest {

    private static final String URL = "http://ai.test/embed";

    private MockRestServiceServer server;
    private EmbedClient embedClient;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();
        embedClient = new EmbedClient(builder.build(), JsonMapper.builder().build());
    }

    @Test
    void sendsTheTextsAndReturnsTheVectorsInOrder() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"texts\":[\"first\",\"second\"]}"))
                .andRespond(withSuccess("""
                        {"model":"gemini-embedding-2","dimensions":2,"embeddings":[[0.5,0.25],[1.0,0.0]]}""",
                        MediaType.APPLICATION_JSON));

        EmbedResponse response = embedClient.embed(List.of("first", "second"));

        assertThat(response.model()).isEqualTo("gemini-embedding-2");
        assertThat(response.dimensions()).isEqualTo(2);
        assertThat(response.embeddings()).hasSize(2);
        assertThat(response.embeddings().get(0)).containsExactly(0.5f, 0.25f);
        assertThat(response.embeddings().get(1)).containsExactly(1.0f, 0.0f);
        server.verify();
    }

    @Test
    void anEmptyBodyIsABadGateway() {
        server.expect(requestTo(URL)).andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void aResponseWithoutVectorsIsABadGateway() {
        server.expect(requestTo(URL)).andRespond(withSuccess("{\"model\":\"m\",\"dimensions\":0}",
                MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY));
    }

    @Test
    void aQuotaAnswerKeepsItsStatusSoTheWorkerCanDeferItsRetry() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\":\"The embedding service is rate limited, retry later.\"}"));

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(ex.getMessage()).contains("rate limited");
                });
    }

    @Test
    void anInvalidPayloadKeepsItsClientStatus() {
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.UNPROCESSABLE_CONTENT)
                .contentType(MediaType.APPLICATION_JSON).body("[]"));

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT);
                    assertThat(ex.getMessage()).isEqualTo("The embedding could not be generated.");
                });
    }

    @Test
    void aServerErrorIsABadGatewayWithoutLeakingTheBody() {
        server.expect(requestTo(URL)).andRespond(withServerError().body("secret internals"));

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(ex.getMessage()).doesNotContain("secret");
                });
    }

    @Test
    void anUnreachableServiceIsAGatewayTimeout() {
        server.expect(requestTo(URL)).andRespond(request -> {
            throw new java.io.IOException("connection refused");
        });

        assertThatThrownBy(() -> embedClient.embed(List.of("text")))
                .isInstanceOfSatisfying(AiServiceException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT));
    }
}
