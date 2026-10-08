package com.linqorbit.config;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import com.linqorbit.user.Role;

/**
 * Claim JWT « roles » (codes SMALLINT émis par AuthService) → autorités Spring
 * Security « ROLE_* ». Code inconnu ignoré : tolérance aux futurs rôles déployés
 * avant cette version du binaire.
 */
public class JwtRoleAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Object claim = jwt.getClaim("roles");
        if (!(claim instanceof Collection<?> roles)) {
            return List.of();
        }
        List<GrantedAuthority> authorities = new ArrayList<>();
        for (Object value : roles) {
            if (value instanceof Number number) {
                try {
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + Role.fromCode(number.shortValue())));
                } catch (IllegalArgumentException unknownRole) {
                    // Rôle plus récent que ce binaire : ignoré sans faire échouer la requête.
                }
            }
        }
        return authorities;
    }
}
