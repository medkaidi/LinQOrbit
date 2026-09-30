package com.linqorbit.auth;

public record AuthResponse(String token, UserResponse user) {
}
