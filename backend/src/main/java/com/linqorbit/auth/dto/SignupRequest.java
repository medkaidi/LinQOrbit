package com.linqorbit.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 255) String password,
        @NotBlank @Size(max = 255) String firstName,
        @NotBlank @Size(max = 255) String lastName,
        @NotBlank @Pattern(regexp = "^[+()\\-.\\s\\d]{6,20}$", message = "must be a valid phone number") String phone,
        @NotBlank @Pattern(regexp = "male|female|other", message = "must be one of male, female, other") String sex,
        @NotBlank @Size(min = 2, max = 2) String homeCountry,
        @NotBlank @Size(max = 255) String currentCity,
        @NotBlank @Size(min = 2, max = 2) String currentCountry) {
}
