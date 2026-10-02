package com.linqorbit.auth;

import java.time.Instant;
import java.util.Locale;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.LoginRequest;
import com.linqorbit.auth.dto.SignupRequest;
import com.linqorbit.auth.exception.AccountNotActiveException;
import com.linqorbit.auth.exception.EmailAlreadyExistsException;
import com.linqorbit.auth.exception.InvalidCredentialsException;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserSex;
import com.linqorbit.user.UserStatus;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    @Value("${app.auth.token-ttl-seconds:86400}")
    private final long tokenTtlSeconds;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        log.info("Signup requested : email={}", email);
        if (userRepository.existsByEmail(email)) {
            log.warn("Signup rejected : email already registered, email={}", email);
            throw new EmailAlreadyExistsException(email);
        }

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .firstName(request.firstName().trim())
                .lastName(request.lastName().trim())
                .phone(request.phone().trim())
                .status(UserStatus.ACTIVE)
                .sex(UserSex.fromApiValue(request.sex()))
                .homeCountry(request.homeCountry())
                .currentCity(request.currentCity().trim())
                .currentCountry(request.currentCountry())
                .build();
        user = userRepository.save(user);
        log.info("Signup succeeded : userId={}, email={}, status={}", user.getId(), email, user.getStatus());

        return buildResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        log.info("Login requested : email={}", email);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            log.warn("Login failed : unknown email, email={}", email);
            throw new InvalidCredentialsException();
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("Login failed : wrong password, email={}", email);
            throw new InvalidCredentialsException();
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            log.warn("Login rejected : account not active, email={}, status={}", email, user.getStatus());
            throw new AccountNotActiveException();
        }
        log.info("Login succeeded : userId={}, email={}", user.getId(), email);

        return buildResponse(user);
    }

    private AuthResponse buildResponse(User user) {
        return new AuthResponse(issueToken(user), userMapper.toUserResponse(user));
    }

    private String issueToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("linqorbit")
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(tokenTtlSeconds))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
