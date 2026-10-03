package com.linqorbit.candidate.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ExperienceRequest(
        @NotBlank @Size(max = 255) String positionTitle,
        @Size(max = 2000) String description,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @NotBlank @Size(max = 255) String companyName,
        @Size(max = 2) String companyCountry) {
}
