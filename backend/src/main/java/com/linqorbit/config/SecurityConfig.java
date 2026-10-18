package com.linqorbit.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import tools.jackson.databind.ObjectMapper;

/**
 * API stateless, CSRF off. Les endpoints d'authentification sont ouverts
 * (permitAll) ; le profil, le changement de mot de passe et le profil candidat
 * exigent un jeton JWT valide (authenticated) ; l'administration exige en plus
 * le rôle ADMIN (claim « roles » converti en autorités ROLE_*).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CorsConfigurationSource corsConfigurationSource,
            JwtAuthenticationConverter jwtAuthenticationConverter, ProblemSecurityHandler problemSecurityHandler)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/change-password").authenticated()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/candidates/**").authenticated()
                        .requestMatchers("/api/v1/recruiters/**").authenticated()
                        .requestMatchers("/api/v1/companies/**").authenticated()
                        .requestMatchers("/api/v1/job-offers/**").authenticated()
                        // Candidatures (V20) : explicitement authentifiées — le
                        // catch-all plus bas rendrait la racine publique (TD-037).
                        .requestMatchers("/api/v1/applications/**").authenticated()
                        // Matching (D58, V21) : explicitement authentifié, même
                        // raison (TD-037).
                        .requestMatchers("/api/v1/matchings/**").authenticated()
                        // Lecture publique d'une offre publiée (V15) : sans jeton,
                        // 404 sûr sur tout ce qui n'est pas PUBLISHED et non expiré.
                        .requestMatchers("/api/v1/jobs/**").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                // 401/403 au format ProblemDetail (détail sûr construit par l'application),
                // jamais le corps vide ni un message brut de la filter chain.
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(problemSecurityHandler)
                        .accessDeniedHandler(problemSecurityHandler))
                .oauth2ResourceServer(rs -> rs
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                        .authenticationEntryPoint(problemSecurityHandler));
        return http.build();
    }

    @Bean
    public ProblemSecurityHandler problemSecurityHandler(ObjectMapper objectMapper) {
        return new ProblemSecurityHandler(objectMapper);
    }

    /**
     * Authentication du jeton : sujet (userId) + autorités issues du claim
     * « roles » (voir {@link JwtRoleAuthoritiesConverter}).
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new JwtRoleAuthoritiesConverter());
        return converter;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") String[] allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
