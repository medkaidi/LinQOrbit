package com.linqorbit.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.linqorbit.auth.dto.AuthResponse;
import com.linqorbit.auth.dto.ChangePasswordRequest;
import com.linqorbit.auth.dto.LoginRequest;
import com.linqorbit.auth.dto.SignupRequest;
import com.linqorbit.auth.dto.UpdateProfileRequest;
import com.linqorbit.auth.dto.UserResponse;
import com.linqorbit.common.security.CurrentUserId;

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
        return ResponseEntity.ok(authService.getProfile(CurrentUserId.from(authentication)));
    }

    @Override
    public ResponseEntity<UserResponse> updateMe(UpdateProfileRequest request, Authentication authentication) {
        return ResponseEntity.ok(authService.updateProfile(CurrentUserId.from(authentication), request));
    }

    @Override
    public ResponseEntity<Void> changePassword(ChangePasswordRequest request, Authentication authentication) {
        authService.changePassword(CurrentUserId.from(authentication), request);
        return ResponseEntity.noContent().build();
    }
}
