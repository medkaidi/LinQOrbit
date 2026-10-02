package com.linqorbit.auth.dto;

public record AuthResponse(String token, UserResponse user) {
}
