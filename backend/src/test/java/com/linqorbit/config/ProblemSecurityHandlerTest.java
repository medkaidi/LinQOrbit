package com.linqorbit.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;

import tools.jackson.databind.ObjectMapper;

class ProblemSecurityHandlerTest {

    private final ProblemSecurityHandler handler = new ProblemSecurityHandler(new ObjectMapper());

    @Test
    void commenceRenvoie401AvecUnDetailSurSansMessageBrut() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.commence(new MockHttpServletRequest(), response,
                new InsufficientAuthenticationException("full internal detail leak"));

        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentType()).contains("problem+json");
        String body = response.getContentAsString();
        assertThat(body).contains(ProblemSecurityHandler.UNAUTHORIZED_DETAIL);
        assertThat(body).doesNotContain("internal detail leak");
    }

    @Test
    void handleRenvoie403AvecUnDetailSur() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(new MockHttpServletRequest(), response,
                new AccessDeniedException("raw denied reason"));

        assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(response.getContentType()).contains("problem+json");
        String body = response.getContentAsString();
        assertThat(body).contains(ProblemSecurityHandler.FORBIDDEN_DETAIL);
        assertThat(body).doesNotContain("raw denied reason");
    }
}
