package com.linqorbit.common.security;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Identifiant du compte derrière la requête courante : toujours extrait du
 * sujet du jeton JWT, jamais d'un paramètre de chemin ou de corps.
 */
public final class CurrentUserId {

    private CurrentUserId() {
    }

    public static UUID from(Authentication authentication) {
        Jwt jwt = (Jwt) authentication.getPrincipal();
        return UUID.fromString(jwt.getSubject());
    }
}
