package com.linqorbit.auth.dto;

import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String sex,
        String phone,
        String homeCountry,
        String currentCity,
        String currentCountry,
        List<Short> roles,
        boolean isRecruiter) {
}
