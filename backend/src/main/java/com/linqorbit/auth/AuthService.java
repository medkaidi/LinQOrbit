package com.linqorbit.auth;

import java.time.Instant;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserSex;
import com.linqorbit.user.UserStatus;

@Service
public class AuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final long tokenTtlSeconds;

    public AuthService(UserRepository userRepository,
            UserMapper userMapper,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder,
            @Value("${app.auth.token-ttl-seconds:86400}") long tokenTtlSeconds) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.tokenTtlSeconds = tokenTtlSeconds;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        LOGGER.info("Signup requested : email={}", email);
        if (userRepository.existsByEmail(email)) {
            LOGGER.warn("Signup rejected : email already registered, email={}", email);
            throw new EmailAlreadyExistsException(email);
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(request.phone().trim());
        user.setStatus(UserStatus.ACTIVE);
        user.setSex(UserSex.fromApiValue(request.sex()));
        user.setHomeCountry(request.homeCountry());
        user.setCurrentCity(request.currentCity().trim());
        user.setCurrentCountry(request.currentCountry());
        user = userRepository.save(user);
        LOGGER.info("Signup succeeded : userId={}, email={}, status={}", user.getId(), email, user.getStatus());

        return buildResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        LOGGER.info("Login requested : email={}", email);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            LOGGER.warn("Login failed : unknown email, email={}", email);
            throw new InvalidCredentialsException();
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            LOGGER.warn("Login failed : wrong password, email={}", email);
            throw new InvalidCredentialsException();
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            LOGGER.warn("Login rejected : account not active, email={}, status={}", email, user.getStatus());
            throw new AccountNotActiveException();
        }
        LOGGER.info("Login succeeded : userId={}, email={}", user.getId(), email);

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
