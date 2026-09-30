package com.linqorbit.auth;

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
        String currentCountry) {
}
