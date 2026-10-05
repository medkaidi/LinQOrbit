package com.linqorbit.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 255) String firstName,
        @NotBlank @Size(max = 255) String lastName,
        @NotBlank @Pattern(regexp = "^[+()\\-.\\s\\d]{6,20}$", message = "must be a valid phone number") String phone,
        @NotBlank @Size(max = 255) String currentCity,
        @NotBlank @Size(min = 2, max = 2) String currentCountry) {
}
