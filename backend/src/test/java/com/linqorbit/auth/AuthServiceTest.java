package com.linqorbit.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.LoginRequest;
import com.linqorbit.auth.dto.SignupRequest;
import com.linqorbit.auth.dto.UserResponse;
import com.linqorbit.auth.exception.AccountNotActiveException;
import com.linqorbit.auth.exception.EmailAlreadyExistsException;
import com.linqorbit.auth.exception.InvalidCredentialsException;
import com.linqorbit.user.User;
import com.linqorbit.user.UserRepository;
import com.linqorbit.user.UserSex;
import com.linqorbit.user.UserStatus;

class AuthServiceTest {

    private UserRepository userRepository;
    private UserMapper userMapper;
    private PasswordEncoder passwordEncoder;
    private JwtEncoder jwtEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userMapper = mock(UserMapper.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtEncoder = mock(JwtEncoder.class);
        authService = new AuthService(userRepository, userMapper, passwordEncoder, jwtEncoder, 3600L);
    }

    @Test
    void signupCreeUnCompteActifEtRetourneUnToken() {
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hash-bcrypt");
        User saved = userWithId();
        saved.setEmail("ada@example.com");
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(userMapper.toUserResponse(saved)).thenReturn(
                new UserResponse(saved.getId(), "ada@example.com", "Ada", "Lovelace",
                        "female", "+1 555 000 0000", "FR", "Paris", "FR"));
        Jwt token = token("jwt-token");
        when(jwtEncoder.encode(any(JwtEncoderParameters.class))).thenReturn(token);

        AuthResponse response = authService.signup(new SignupRequest(
                "  ADA@Example.COM ", "secret123", " Ada ", "Lovelace",
                "+1 555 000 0000", "female", "FR", "Paris", "FR"));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().sex()).isEqualTo("female");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User user = captor.getValue();
        assertThat(user.getEmail()).isEqualTo("ada@example.com");
        assertThat(user.getPasswordHash()).isEqualTo("hash-bcrypt");
        assertThat(user.getFirstName()).isEqualTo("Ada");
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(user.getSex()).isEqualTo(UserSex.FEMALE);
        assertThat(user.getHomeCountry()).isEqualTo("FR");
        assertThat(user.getCurrentCity()).isEqualTo("Paris");
    }

    @Test
    void signupRejetteUnEmailDejaUtilise() {
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(new SignupRequest(
                "ada@example.com", "secret123", "Ada", "Lovelace",
                "+1 555 000 0000", "female", "FR", "Paris", "FR")))
                .isInstanceOf(EmailAlreadyExistsException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void loginRetourneUnTokenPourUnCompteActif() {
        User user = userWithId();
        user.setEmail("ada@example.com");
        user.setPasswordHash("hash-bcrypt");
        user.setStatus(UserStatus.ACTIVE);
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hash-bcrypt")).thenReturn(true);
        when(userMapper.toUserResponse(user)).thenReturn(
                new UserResponse(user.getId(), "ada@example.com", "Ada", "Lovelace",
                        "male", "+1 555 000 0000", "FR", "Paris", "FR"));
        Jwt token = token("jwt-token");
        when(jwtEncoder.encode(any(JwtEncoderParameters.class))).thenReturn(token);

        AuthResponse response = authService.login(new LoginRequest("Ada@Example.COM", "secret123"));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().id()).isEqualTo(user.getId());
    }

    @Test
    void loginRejetteUnMotDePasseIncorrect() {
        User user = userWithId();
        user.setEmail("ada@example.com");
        user.setPasswordHash("hash-bcrypt");
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hash-bcrypt")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("ada@example.com", "wrong")))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(jwtEncoder, never()).encode(any());
    }

    @Test
    void loginRejetteUnEmailInconnu() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost@example.com", "secret123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void loginRejetteUnCompteInactif() {
        User user = userWithId();
        user.setEmail("ada@example.com");
        user.setPasswordHash("hash-bcrypt");
        user.setStatus(UserStatus.SUSPENDED);
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hash-bcrypt")).thenReturn(true);

        assertThatThrownBy(() -> authService.login(new LoginRequest("ada@example.com", "secret123")))
                .isInstanceOf(AccountNotActiveException.class);
        verify(jwtEncoder, never()).encode(any());
    }

    private static User userWithId() {
        return User.builder().id(UUID.randomUUID()).build();
    }

    private static Jwt token(String value) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getTokenValue()).thenReturn(value);
        return jwt;
    }
}
