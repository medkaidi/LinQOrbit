package com.linqorbit.auth;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.ChangePasswordRequest;
import com.linqorbit.auth.dto.LoginRequest;
import com.linqorbit.auth.dto.SignupRequest;
import com.linqorbit.auth.dto.UserResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController implements AuthApi {

    private final AuthService authService;

    @Override
    public ResponseEntity<AuthResponse> signup(SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }

    @Override
    public ResponseEntity<AuthResponse> login(LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Override
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        return ResponseEntity.ok(authService.getProfile(currentUserId(authentication)));
    }

    @Override
    public ResponseEntity<Void> changePassword(ChangePasswordRequest request, Authentication authentication) {
        authService.changePassword(currentUserId(authentication), request);
        return ResponseEntity.noContent().build();
    }

    private static UUID currentUserId(Authentication authentication) {
        Jwt jwt = (Jwt) authentication.getPrincipal();
        return UUID.fromString(jwt.getSubject());
    }
}
