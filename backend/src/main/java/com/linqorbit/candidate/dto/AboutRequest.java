package com.linqorbit.candidate.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AboutRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 2000) String bio,
        @NotNull @Min(0) @Max(60) Integer yearsOfExperience,
        @NotBlank String searchStatus) {
}
